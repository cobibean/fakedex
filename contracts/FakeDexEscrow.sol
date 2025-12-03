// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IMintableToken
 * @dev Interface for tFAKEUSD which has a mint function
 */
interface IMintableToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title FakeDexEscrow
 * @dev Trading account escrow for FakeDEX platform
 * 
 * Flow:
 * 1. User calls claimToTrading() - mints tokens directly to escrow, credits trading balance
 * 2. User trades using off-chain Supabase balance tracking
 * 3. User calls withdraw() with backend-signed approval based on their PnL
 * 
 * Features:
 * - Direct faucet claim to trading account
 * - Deposit existing tokens
 * - Backend-signed withdrawals
 * - Future-proof withdrawal limits (disabled by default)
 */
contract FakeDexEscrow is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ State Variables ============

    IMintableToken public token;
    address public backendSigner;
    
    // Faucet settings (mirrors tFAKEUSD defaults)
    uint256 public faucetAmount = 1000 * 10**18;
    uint256 public faucetCooldown = 24 hours;
    mapping(address => uint256) public lastFaucetClaim;
    
    // Withdrawal limits (0 = no limit, future-proofed)
    uint256 public maxWithdrawalPerTx;
    uint256 public dailyWithdrawalLimit;
    mapping(address => uint256) public dailyWithdrawn;
    mapping(address => uint256) public lastWithdrawalDay;
    
    // Nonces for replay protection on withdrawals
    mapping(address => uint256) public withdrawalNonces;
    
    // Total deposits tracking (for analytics)
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalFaucetClaims;

    // ============ Events ============

    event DepositedToTrading(address indexed user, uint256 amount);
    event WithdrawnFromTrading(address indexed user, uint256 amount);
    event FaucetClaimedToTrading(address indexed user, uint256 amount);
    event BackendSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event FaucetSettingsUpdated(uint256 amount, uint256 cooldown);
    event WithdrawalLimitsUpdated(uint256 maxPerTx, uint256 dailyLimit);

    // ============ Errors ============

    error ZeroAddress();
    error ZeroAmount();
    error FaucetCooldownActive(uint256 timeRemaining);
    error InvalidNonce(uint256 expected, uint256 received);
    error InvalidSignature();
    error ExceedsMaxPerTx(uint256 requested, uint256 max);
    error ExceedsDailyLimit(uint256 requested, uint256 remaining);
    error InsufficientContractBalance();
    error TransferFailed();

    // ============ Constructor ============

    constructor(address _token, address _backendSigner) Ownable(msg.sender) {
        if (_token == address(0) || _backendSigner == address(0)) revert ZeroAddress();
        
        token = IMintableToken(_token);
        backendSigner = _backendSigner;
    }

    // ============ User Functions ============

    /**
     * @dev Claim from faucet directly to trading account
     * Mints tokens to this contract (escrow) and emits event for backend tracking
     */
    function claimToTrading() external nonReentrant {
        uint256 nextClaimTime = lastFaucetClaim[msg.sender] + faucetCooldown;
        if (block.timestamp < nextClaimTime) {
            revert FaucetCooldownActive(nextClaimTime - block.timestamp);
        }
        
        lastFaucetClaim[msg.sender] = block.timestamp;
        totalFaucetClaims += faucetAmount;
        
        // Mint directly to this contract (escrow)
        // Note: This contract must be whitelisted in tFAKEUSD for unlimited minting
        token.mint(address(this), faucetAmount);
        
        emit FaucetClaimedToTrading(msg.sender, faucetAmount);
        emit DepositedToTrading(msg.sender, faucetAmount);
    }

    /**
     * @dev Deposit existing tokens from wallet to trading account
     * @param amount Amount of tokens to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        
        totalDeposited += amount;
        
        // Transfer tokens from user to this contract
        bool success = token.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        emit DepositedToTrading(msg.sender, amount);
    }

    /**
     * @dev Withdraw tokens with backend approval
     * Backend signs the withdrawal based on user's Supabase trading balance
     * 
     * @param amount Amount to withdraw
     * @param nonce User's current withdrawal nonce (prevents replay)
     * @param signature Backend signature authorizing this withdrawal
     */
    function withdraw(
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        // Verify amount is non-zero
        if (amount == 0) revert ZeroAmount();
        
        // Verify nonce
        if (nonce != withdrawalNonces[msg.sender]) {
            revert InvalidNonce(withdrawalNonces[msg.sender], nonce);
        }
        
        // Verify backend signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            amount,
            nonce,
            block.chainid,
            address(this)
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        
        if (signer != backendSigner) revert InvalidSignature();
        
        // Check per-transaction limit (0 = no limit)
        if (maxWithdrawalPerTx > 0 && amount > maxWithdrawalPerTx) {
            revert ExceedsMaxPerTx(amount, maxWithdrawalPerTx);
        }
        
        // Check daily limit (0 = no limit)
        if (dailyWithdrawalLimit > 0) {
            uint256 today = block.timestamp / 1 days;
            
            // Reset daily counter if new day
            if (lastWithdrawalDay[msg.sender] < today) {
                dailyWithdrawn[msg.sender] = 0;
                lastWithdrawalDay[msg.sender] = today;
            }
            
            uint256 remaining = dailyWithdrawalLimit - dailyWithdrawn[msg.sender];
            if (amount > remaining) {
                revert ExceedsDailyLimit(amount, remaining);
            }
            
            dailyWithdrawn[msg.sender] += amount;
        }
        
        // Increment nonce
        withdrawalNonces[msg.sender]++;
        totalWithdrawn += amount;
        
        // Transfer tokens (mint more if contract balance insufficient)
        uint256 contractBalance = token.balanceOf(address(this));
        if (contractBalance < amount) {
            // Mint the difference - this is how winners get paid out
            token.mint(address(this), amount - contractBalance);
        }
        
        bool success = token.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
        
        emit WithdrawnFromTrading(msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @dev Check if an address can claim from faucet
     */
    function canClaim(address account) external view returns (bool) {
        return block.timestamp >= lastFaucetClaim[account] + faucetCooldown;
    }

    /**
     * @dev Get time remaining until next faucet claim
     */
    function timeUntilNextClaim(address account) external view returns (uint256) {
        uint256 nextClaimTime = lastFaucetClaim[account] + faucetCooldown;
        if (block.timestamp >= nextClaimTime) {
            return 0;
        }
        return nextClaimTime - block.timestamp;
    }

    /**
     * @dev Get current escrow balance (total tokens held)
     */
    function escrowBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Get user's remaining daily withdrawal allowance
     */
    function remainingDailyWithdrawal(address account) external view returns (uint256) {
        if (dailyWithdrawalLimit == 0) {
            return type(uint256).max; // No limit
        }
        
        uint256 today = block.timestamp / 1 days;
        if (lastWithdrawalDay[account] < today) {
            return dailyWithdrawalLimit; // Full allowance (new day)
        }
        
        if (dailyWithdrawn[account] >= dailyWithdrawalLimit) {
            return 0;
        }
        return dailyWithdrawalLimit - dailyWithdrawn[account];
    }

    // ============ Admin Functions ============

    /**
     * @dev Update the backend signer address
     */
    function setBackendSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        
        address oldSigner = backendSigner;
        backendSigner = _signer;
        
        emit BackendSignerUpdated(oldSigner, _signer);
    }

    /**
     * @dev Update faucet settings
     */
    function setFaucetSettings(uint256 _amount, uint256 _cooldown) external onlyOwner {
        faucetAmount = _amount;
        faucetCooldown = _cooldown;
        
        emit FaucetSettingsUpdated(_amount, _cooldown);
    }

    /**
     * @dev Update withdrawal limits (0 = no limit)
     */
    function setWithdrawalLimits(uint256 _maxPerTx, uint256 _dailyLimit) external onlyOwner {
        maxWithdrawalPerTx = _maxPerTx;
        dailyWithdrawalLimit = _dailyLimit;
        
        emit WithdrawalLimitsUpdated(_maxPerTx, _dailyLimit);
    }

    /**
     * @dev Emergency withdraw for admin (in case of issues)
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        
        bool success = token.transfer(to, amount);
        if (!success) revert TransferFailed();
    }
}

