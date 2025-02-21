use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Provided token ratio is incorrect.")]
    InvalidRatio,
}

