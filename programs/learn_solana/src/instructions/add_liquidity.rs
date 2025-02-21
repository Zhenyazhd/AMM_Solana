use anchor_lang::prelude::*;
use anchor_spl::token::{
    Mint,
    mint_to, MintTo,
    Token, TokenAccount,
    transfer, Transfer
};
use crate::state::LiquidityPool;
use std::cmp;
use crate::error::CustomError;

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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
    pub user_lp: Account<'info, TokenAccount>,

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

pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_x: u64, amount_y: u64) -> Result<()> {
    require!(
        ctx.accounts.user_x.amount >= amount_x,
        CustomError::InsufficientFunds
    );
    require!(
        ctx.accounts.user_y.amount >= amount_y,
        CustomError::InsufficientFunds
    );

    let lp_supply = ctx.accounts.pool.lp_supply;
    let authority = ctx.accounts.pool.to_account_info(); 
    let pool = &mut ctx.accounts.pool; 

    let lp_tokens_minted: u64;

    if lp_supply > 0 {
        let ratio_x = (amount_x as u128) * (pool.token_amount_y as u128);
        let ratio_y = (amount_y as u128) * (pool.token_amount_x as u128);

        require!(
            ratio_x == ratio_y,
            CustomError::InvalidRatio
        );
        let lp_tokens_x = (amount_x as u128) * (pool.lp_supply as u128) / (pool.token_amount_x as u128);
        let lp_tokens_y = (amount_y as u128) * (pool.lp_supply as u128) / (pool.token_amount_y as u128);
        
        lp_tokens_minted = cmp::min(lp_tokens_x, lp_tokens_y) as u64;
    } else {
        let lp_tokens = (amount_x as u128).saturating_mul(amount_y as u128);
        lp_tokens_minted = (lp_tokens as f64).sqrt() as u64;
    }

    pool.token_amount_x += amount_x;
    pool.token_amount_y += amount_y;
    pool.lp_supply += lp_tokens_minted;

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_x.to_account_info(),
                to: ctx.accounts.pool_x.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_x,
    )?;


    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_y.to_account_info(),
                to: ctx.accounts.pool_y.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount_y,
    )?;

    let seeds = &[b"pool", pool.x_mint.as_ref(), pool.y_mint.as_ref(), &[ctx.bumps.pool]];
    let signer_seeds = &[&seeds[..]];
    
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp.to_account_info(),
                authority: authority,
            },
            signer_seeds,
        ),
        lp_tokens_minted,
    )?;

    Ok(())
}