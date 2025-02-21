use anchor_lang::prelude::*;

#[account]
pub struct LiquidityPool {
    pub authority: Pubkey,   // 32 bytes
    pub x_mint: Pubkey,      // 32 bytes
    pub y_mint: Pubkey,      // 32 bytes
    pub lp_mint: Pubkey,     // 32 bytes
    pub token_amount_x: u64, // 8 bytes
    pub token_amount_y: u64, // 8 bytes
    pub lp_supply: u64,      // 8 bytes
    pub fee: u64,            // 8 bytes
}
