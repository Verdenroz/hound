import * as xrpl from 'xrpl';
import { XRPLTransaction } from '../utils/types';

export class XRPLService {
  private client: xrpl.Client;
  private isConnected: boolean = false;

  // Official Ripple RLUSD issuer addresses (verified from docs.ripple.com)
  // RLUSD uses "USD" currency code with Ripple's issuer address
  // Testnet: rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV
  // Mainnet: rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De
  private readonly RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';
  private readonly RLUSD_CURRENCY = 'USD'; // Standard 3-letter code

  constructor() {
    // Use XRPL testnet for development
    this.client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Connected to XRPL Testnet');
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('❌ Disconnected from XRPL');
    }
  }

  async createWallet(): Promise<xrpl.Wallet> {
    await this.connect();

    // Fund a new wallet on testnet
    const fundResult = await this.client.fundWallet();
    const wallet = fundResult.wallet;

    console.log('💰 New XRPL Wallet Created:');
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Seed: ${wallet.seed}`);
    console.log(`  Balance: ${fundResult.balance} XRP`);

    return wallet;
  }

  async getWalletFromSeed(seed: string): Promise<xrpl.Wallet> {
    return xrpl.Wallet.fromSeed(seed);
  }

  async getBalance(address: string): Promise<string> {
    await this.connect();

    const response = await this.client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });

    // Balance is returned as a string in drops, convert to XRP
    return String(xrpl.dropsToXrp(response.result.account_data.Balance));
  }

  /**
   * Set up a trustline for RLUSD
   * Required before the wallet can hold/receive RLUSD tokens
   */
  async setupRLUSDTrustline(wallet: xrpl.Wallet): Promise<boolean> {
    await this.connect();

    try {
      console.log('🔗 Setting up RLUSD trustline...');

      const trustSet: xrpl.TrustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: this.RLUSD_CURRENCY,
          issuer: this.RLUSD_ISSUER,
          value: '1000000', // Max 1M RLUSD
        },
      };

      const prepared = await this.client.autofill(trustSet);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object') {
        const meta = result.result.meta as any;
        if (meta.TransactionResult === 'tesSUCCESS') {
          console.log('✅ RLUSD trustline established');
          return true;
        }
      }

      console.log('⚠️  Trustline setup failed (may already exist)');
      return false;
    } catch (error: any) {
      // Trustline may already exist - that's okay
      if (error.message?.includes('tecDUPLICATE')) {
        console.log('✅ RLUSD trustline already exists');
        return true;
      }
      console.error('❌ Trustline setup error:', error.message);
      return false;
    }
  }

  /**
   * Get RLUSD balance for an account
   */
  async getRLUSDBalance(address: string): Promise<string> {
    await this.connect();

    try {
      const response = await this.client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated',
      });

      const rlusdLine = response.result.lines.find(
        (line: any) =>
          line.currency === this.RLUSD_CURRENCY &&
          line.account === this.RLUSD_ISSUER
      );

      return rlusdLine ? rlusdLine.balance : '0';
    } catch (error) {
      return '0';
    }
  }

  async executeTrade(
    wallet: xrpl.Wallet,
    action: 'buy' | 'sell',
    ticker: string,
    amountUSD: number
  ): Promise<XRPLTransaction> {
    await this.connect();

    // Use RLUSD (Ripple's USD stablecoin) for real-world value representation
    // This demonstrates cross-border payments and DeFi use case for XRPL challenge
    const rlusdAmount = amountUSD.toString();

    // Broker address for hackathon demo
    // In production: real exchange/broker with RLUSD support
    const brokerAddress = process.env.XRPL_BROKER_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY';

    // Create payment transaction with trade details in memo
    const tradeDetails = {
      action,
      ticker,
      amountUSD,
      currency: 'RLUSD',
      timestamp: new Date().toISOString(),
      agent: 'Hound AI Trading Agent',
      description: `Autonomous ${action} order for ${ticker} stock worth $${amountUSD} USD`,
    };

    // Payment using RLUSD token (not native XRP)
    const payment: xrpl.Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: brokerAddress,
      Amount: {
        currency: this.RLUSD_CURRENCY,
        issuer: this.RLUSD_ISSUER,
        value: rlusdAmount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('TRADE_EXECUTION', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify(tradeDetails), 'utf8')
              .toString('hex')
              .toUpperCase(),
          },
        },
      ],
    };

    try {
      // Prepare transaction
      const prepared = await this.client.autofill(payment);

      // Sign transaction
      const signed = wallet.sign(prepared);

      // Submit and wait for validation
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object') {
        const meta = result.result.meta as any;

        if (meta.TransactionResult === 'tesSUCCESS') {
          const hash = result.result.hash;
          const explorerLink = `https://testnet.xrpl.org/transactions/${hash}`;

          console.log('✅ XRPL Transaction Successful:');
          console.log(`  Hash: ${hash}`);
          console.log(`  Explorer: ${explorerLink}`);

          return { hash, explorerLink };
        } else {
          throw new Error(`Transaction failed: ${meta.TransactionResult}`);
        }
      } else {
        throw new Error('Invalid transaction result');
      }
    } catch (error: any) {
      console.error('❌ XRPL Transaction Failed:', error.message);
      throw error;
    }
  }

  async sendPayment(
    fromWallet: xrpl.Wallet,
    toAddress: string,
    amount: string
  ): Promise<XRPLTransaction> {
    await this.connect();

    const payment: xrpl.Payment = {
      TransactionType: 'Payment',
      Account: fromWallet.address,
      Destination: toAddress,
      Amount: xrpl.xrpToDrops(amount),
    };

    const prepared = await this.client.autofill(payment);
    const signed = fromWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    const hash = result.result.hash;
    const explorerLink = `https://testnet.xrpl.org/transactions/${hash}`;

    return { hash, explorerLink };
  }
}