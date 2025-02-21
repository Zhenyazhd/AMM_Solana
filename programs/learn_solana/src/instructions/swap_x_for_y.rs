use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, transfer, Transfer};
use crate::state::LiquidityPool;
use crate::error::CustomError;

#[derive(Accounts)]
pub struct SwapXForY<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(mut)]
    pub user_x: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_y: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_x: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_y: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn swap_x_for_y(ctx: Context<SwapXForY>, amount_in: u64) -> Result<()> {
    require!(
        ctx.accounts.user_x.amount >= amount_in,
        CustomError::InsufficientFunds
    );

    let pool = &mut ctx.accounts.pool;

    let fee_amount = (amount_in * pool.fee) / 10_000; 
    let amount_in_after_fee = amount_in - fee_amount; 

    let amount_out: u64 = ((pool.token_amount_y  as u128).saturating_mul(amount_in_after_fee as u128) as u64 )/ (pool.token_amount_x + amount_in_after_fee);
    
    require!(
        amount_out != 0,
        CustomError::InvalidRatio
    );


    pool.token_amount_x += amount_in;
    pool.token_amount_y -= amount_out;

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_x.to_account_info(),
                to: ctx.accounts.pool_x.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_in,
    )?;        

    let seeds = &[b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref(), &[ctx.bumps.pool]];
    let signer_seeds = &[&seeds[..]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_y.to_account_info(),
                to: ctx.accounts.user_y.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount_out,
    )?;        

    Ok(())
}