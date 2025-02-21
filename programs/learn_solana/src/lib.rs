use anchor_lang::prelude::*;

pub mod error;
pub mod state;


mod instructions;

use instructions::*;

declare_id!("HnmmjkrqcdYwy1wCvnPPF6grTim4HroDyBx7cUmwfs8L");

#[program]
pub mod amm {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, authority: Pubkey, fee: u64) -> Result<()> {
        instructions::initialize::initialize(ctx, authority, fee)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_x: u64, amount_y: u64) -> Result<()> {
        instructions::add_liquidity::add_liquidity(ctx, amount_x, amount_y)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_tokens: u64) -> Result<()> {
        instructions::remove_liquidity::remove_liquidity(ctx, lp_tokens)
    }

    pub fn swap_x_for_y(ctx: Context<SwapXForY>, amount_in: u64) -> Result<()> {
        instructions::swap_x_for_y::swap_x_for_y(ctx, amount_in)
    }

    pub fn swap_y_for_x(ctx: Context<SwapYForX>, amount_in: u64) -> Result<()> {
        instructions::swap_y_for_x::swap_y_for_x(ctx, amount_in)
    }
}