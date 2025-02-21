use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount,burn,Burn, transfer, Transfer, Mint};
use crate::state::LiquidityPool;
use crate::error::CustomError;

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref()],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(mut)]
    pub user_lp: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_x: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_y: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [pool.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    #[account(mut)]
    pub pool_x: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_y: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_tokens: u64) -> Result<()> {
    require!(
        ctx.accounts.user_lp.amount >= lp_tokens,
        CustomError::InsufficientFunds
    );

    let pool = &mut ctx.accounts.pool;


    let amount_out_x = ((lp_tokens as u128).saturating_mul(pool.token_amount_x as u128) as u64 )/ pool.lp_supply;
    let amount_out_y = ((lp_tokens as u128).saturating_mul(pool.token_amount_y as u128) as u64 )/ pool.lp_supply;

    require!(
        ctx.accounts.pool_x.amount >= amount_out_x,
        CustomError::InsufficientFunds
    );

    require!(
        ctx.accounts.pool_y.amount >= amount_out_y,
        CustomError::InsufficientFunds
    );

   
    pool.token_amount_x -= amount_out_x;
    pool.token_amount_y -= amount_out_y;
    pool.lp_supply -= lp_tokens;


    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        lp_tokens,
    )?;

    let seeds = &[b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref(), &[ctx.bumps.pool]];
    let signer_seeds = &[&seeds[..]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_x.to_account_info(),
                to: ctx.accounts.user_x.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount_out_x,
    )?;

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
        amount_out_y,
    )?;
    
    Ok(())
}