use anchor_lang::prelude::*;
use crate::state::LiquidityPool;
use anchor_spl::token::{Mint, Token};


#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init, 
        payer = payer, 
        space = 8 + 160,
        seeds = [b"pool", token_x.key().as_ref(), token_y.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,

    pub token_x: Account<'info, Mint>,
    pub token_y: Account<'info, Mint>,

    #[account(
        init, 
        payer = payer, 
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [pool.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}

pub fn initialize(ctx: Context<InitializePool>, authority: Pubkey, fee: u64) -> Result<()> {
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