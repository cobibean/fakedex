import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Get escrow address and chain ID
const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
const CHAIN_ID = 11155111; // Sepolia

// Backend signer private key - MUST be set in production!
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY;

export async function POST(request: NextRequest) {
  try {
    // Check configuration
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    if (!ESCROW_ADDRESS) {
      return NextResponse.json(
        { error: 'Escrow contract not deployed' },
        { status: 500 }
      );
    }

    if (!BACKEND_SIGNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Backend signer not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { address, amount, nonce } = body;

    if (!address || amount === undefined || nonce === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: address, amount, nonce' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!ethers.isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    // Normalize address to checksum format for consistent signature
    const checksumAddress = ethers.getAddress(address);

    // Convert amount to BigInt for validation
    let amountBigInt: bigint;
    try {
      amountBigInt = BigInt(amount);
    } catch {
      return NextResponse.json(
        { error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    if (amountBigInt <= 0n) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    // Get user from database (use original address as stored in DB may not be checksummed)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', checksumAddress)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's trading balance
    const { data: balanceData, error: balanceError } = await supabase
      .from('user_balances')
      .select('amount')
      .eq('user_id', user.id)
      .eq('symbol', 'FAKEUSD')
      .maybeSingle();

    if (balanceError) {
      console.error('Balance fetch error:', balanceError);
      return NextResponse.json(
        { error: 'Failed to fetch balance' },
        { status: 500 }
      );
    }

    const tradingBalance = Number(balanceData?.amount || 0);
    const requestedAmount = Number(amountBigInt) / 1e18;

    // Verify user has sufficient balance
    if (requestedAmount > tradingBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${tradingBalance.toFixed(2)}, Requested: ${requestedAmount.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Create the message hash matching the contract's format
    // keccak256(abi.encodePacked(user, amount, nonce, chainId, contractAddress))
    // Use checksummed address to match what contract sees from msg.sender
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'address'],
      [checksumAddress, amountBigInt, nonce, CHAIN_ID, ESCROW_ADDRESS]
    );

    // Sign the message
    const wallet = new ethers.Wallet(BACKEND_SIGNER_PRIVATE_KEY);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Log for debugging (remove in production)
    console.log('Withdrawal signature generated:', {
      address: checksumAddress,
      amount: amountBigInt.toString(),
      nonce,
      chainId: CHAIN_ID,
      escrowAddress: ESCROW_ADDRESS,
      signerAddress: wallet.address,
    });

    return NextResponse.json({
      signature,
      signerAddress: wallet.address,
      amount: amountBigInt.toString(),
      nonce,
    });

  } catch (error) {
    console.error('Withdrawal sign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for checking configuration
export async function GET() {
  return NextResponse.json({
    configured: {
      supabase: !!supabase,
      escrowAddress: !!ESCROW_ADDRESS,
      backendSigner: !!BACKEND_SIGNER_PRIVATE_KEY,
    },
    escrowAddress: ESCROW_ADDRESS || null,
    chainId: CHAIN_ID,
  });
}

