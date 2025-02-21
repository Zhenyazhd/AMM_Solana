# Solana AMM (Automated Market Maker) Prototype

This project is a prototype of an Automated Market Maker (AMM) implemented on the Solana blockchain using the Anchor framework.
It was created as a learning exercise to understand Solana smart contracts, how state management works, and how to interact with Solana’s token system.

## Overview

This AMM implementation enables users to:

•	Initialize a liquidity pool for two token pairs (Token X and Token Y).
	
•	Add liquidity to the pool in exchange for LP tokens.
	
•	Remove liquidity by redeeming LP tokens.
	
•	Swap tokens (Token X for Token Y and vice versa) using a simple AMM pricing formula.

How It Works

1.	Liquidity Pool Initialization:

	•	A liquidity pool account is created.
    
	•	A new LP token mint is generated for liquidity providers.

2.	Adding Liquidity:

	•	Users deposit Token X and Token Y into the pool.

	•	LP tokens are minted to represent the user’s share of the pool.

3.	Removing Liquidity:

	•	Users redeem LP tokens to receive a proportionate amount of Token X and Token Y back.

4.	Swaps:
	
    •	Users can exchange Token X for Token Y or Token 
    Y for Token X using a constant product formula.
	
    •	A fee is taken from each trade.

## Smart Contract Details

### Liquidity Pool Structure

```rust
#[account]
pub struct LiquidityPool {
    pub authority: Pubkey,   // Pool authority
    pub x_mint: Pubkey,      // Mint address for Token X
    pub y_mint: Pubkey,      // Mint address for Token Y
    pub lp_mint: Pubkey,     // Mint address for LP tokens
    pub token_amount_x: u64, // Total amount of Token X in the pool
    pub token_amount_y: u64, // Total amount of Token Y in the pool
    pub lp_supply: u64,      // Total LP tokens minted
    pub fee: u64,            // Trading fee
}
```

### Program Instructions

1. Pool Initialization
```rust
pub fn initialize_pool(ctx: Context<InitializePool>, authority: Pubkey, fee: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.authority = authority;
    pool.x_mint = ctx.accounts.token_x.key();
    pool.y_mint = ctx.accounts.token_y.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    pool.token_amount_x = 0;
    pool.token_amount_y = 0;
    pool.lp_supply = 0;
    pool.fee = fee; 
    Ok(())
}
```

•	Creates a new liquidity pool.

•	Generates an LP token mint to track liquidity providers.

2. Adding Liquidity

```rust
pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_x: u64, amount_y: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    
    let lp_tokens_minted = if pool.lp_supply > 0 {
        let ratio_x = (amount_x as u128) * (pool.token_amount_y as u128);
        let ratio_y = (amount_y as u128) * (pool.token_amount_x as u128);
        require!(ratio_x == ratio_y, CustomError::InvalidRatio);

        let lp_x = (amount_x as u128) * (pool.lp_supply as u128) / (pool.token_amount_x as u128);
        let lp_y = (amount_y as u128) * (pool.lp_supply as u128) / (pool.token_amount_y as u128);
        cmp::min(lp_x, lp_y) as u64
    } else {
        ((amount_x as u128) * (amount_y as u128)).sqrt() as u64
    };

    pool.token_amount_x += amount_x;
    pool.token_amount_y += amount_y;
    pool.lp_supply += lp_tokens_minted;

    // Transfer Token X and Token Y into the pool
    transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.user_x.to_account_info(),
            to: ctx.accounts.pool_x.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        }),
        amount_x,
    )?;

    transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.user_y.to_account_info(),
            to: ctx.accounts.pool_y.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        }),
        amount_y,
    )?;

    // Mint LP tokens to user
    let seeds = &[b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref(), &[ctx.bumps.pool]];
    let signer_seeds = &[&seeds[..]];
    
    mint_to(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), MintTo {
            mint: ctx.accounts.lp_mint.to_account_info(),
            to: ctx.accounts.user_lp.to_account_info(),
            authority: pool.to_account_info(),
        }, signer_seeds),
        lp_tokens_minted,
    )?;

    Ok(())
}
```

•	Transfers Token X and Token Y into the pool.

•	Mints LP tokens for the liquidity provider.

3. Swapping Tokens

```rust
pub fn swap_x_for_y(ctx: Context<SwapXForY>, amount_in: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let amount_out = ((pool.token_amount_y as u128) * (amount_in as u128) / (pool.token_amount_x + amount_in)) as u64;
    
    require!(amount_out != 0, CustomError::InvalidRatio);
    
    pool.token_amount_x += amount_in;
    pool.token_amount_y -= amount_out;

    transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.user_x.to_account_info(),
            to: ctx.accounts.pool_x.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        }),
        amount_in,
    )?;

    let seeds = &[b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref(), &[ctx.bumps.pool]];
    let signer_seeds = &[&seeds[..]];

    transfer(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.pool_y.to_account_info(),
            to: ctx.accounts.user_y.to_account_info(),
            authority: pool.to_account_info(),
        }, signer_seeds),
        amount_out,
    )?;

    Ok(())
}
```

•	Implements a basic swap function.

•	Uses a constant product formula to determine the output amount.

### Error Handling

Custom error messages are implemented using Anchor’s error system:

```rust
#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Provided token ratio is incorrect.")]
    InvalidRatio,
}
```

•	Prevents insufficient balance transactions.
•	Ensures correct token ratios when adding liquidity.

## Project Goals

This project was developed to:

✔️ Gain experience with Solana smart contract development

✔️ Learn Anchor framework and CPI (Cross-Program Invocation)

✔️ Understand state management in Solana programs

✔️ Implement token interactions using anchor_spl::token

## How to Run the Project
	
1.	Clone the repository

```bash
git clone https://github.com/your-repo/solana-amm.git
cd solana-amm
```

2.	Install dependencies

```bash
npm install
```

3.	Deploy the smart contract

```bash
anchor build
anchor deploy
```
4.	Run the test suite

```bash
anchor test
```

## Future Improvements

- Implement a more sophisticated price calculation
- Add transaction fee distribution
- Support for multiple liquidity pools

