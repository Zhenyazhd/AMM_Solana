import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import {
  approve,
  createAccount,
  Account,
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from '@solana/spl-token';



function getContext(context: any){
  console.log("🔍 Pre-transaction context:", JSON.stringify(context, (_, v) => 
      typeof v === "bigint" ? v.toString() : v, 
      2
  ));
}


async function checkBalances(
  provider: any, 
  ownerX: any, 
  ownerY: any, 
  ownerLp: any,
  poolX: any, 
  poolY: any,
  aliceX: any,
  aliceY: any
) {
  const balanceOwnerX =Number((
    await provider.connection.getTokenAccountBalance(ownerX.address)
  ).value.amount);

  const balanceOwnerY = Number((
    await provider.connection.getTokenAccountBalance(ownerY.address)
  ).value.amount);

  const balancePoolX =Number((
    await provider.connection.getTokenAccountBalance(poolX)
  ).value.amount);

  const balancePoolY = Number((
    await provider.connection.getTokenAccountBalance(poolY)
  ).value.amount);

  const balanceOwnerLp = Number((
    await provider.connection.getTokenAccountBalance(ownerLp.address)
  ).value.amount);

  const balanceAliceX = Number((
    await provider.connection.getTokenAccountBalance(aliceX.address)
  ).value.amount);

  const balanceAliceY = Number((
    await provider.connection.getTokenAccountBalance(aliceY.address)
  ).value.amount);

  return {
    ownerX: balanceOwnerX, 
    ownerY: balanceOwnerY, 
    poolX: balancePoolX, 
    poolY: balancePoolY, 
    ownerLp: balanceOwnerLp,
    aliceX: balanceAliceX,
    aliceY: balanceAliceY
  };
}


async function checkDifferenceAfter(
  balancesBefore: any, 
  difference: any, 
  provider: any, 
  ownerX: any, 
  ownerY: any, 
  ownerLp: any,
  poolX: any, 
  poolY: any,
  aliceX: any,
  aliceY: any
){
  const balancesAfter = await checkBalances(provider, 
    ownerX, 
    ownerY, 
    ownerLp,
    poolX, 
    poolY,
    aliceX,
    aliceY
  );

  for (const key of Object.keys(balancesAfter)) {
    expect(balancesBefore[key]+ difference[key]).to.be.closeTo(balancesAfter[key], 2);
  }
}

describe("Small AMM", () => {
  let provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const owner = anchor.web3.Keypair.generate();
  const alice = anchor.web3.Keypair.generate();

  let mintX: anchor.web3.PublicKey;
  let mintY: anchor.web3.PublicKey;

  let ownerX;
  let ownerY;
  let poolX;
  let poolY;

  let aliceX: Account;
  let aliceY: Account;

  let poolPda;

  let lpMintPda;
  let ownerLp;

  let lpSupply;
  let poolY_A;
  let poolX_A;

  const program = anchor.workspace.Amm as Program<Amm>;
  const fee = 10;
  const amount = 1_000_000_000; 




  before(async () => {
    const airdropSol = async (user) => {

      const signature = await provider.connection.requestAirdrop(
        user.publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 100 
      );

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });
    };

    await airdropSol(owner);
    await airdropSol(alice);

    mintX = await createMint(provider.connection, owner, owner.publicKey, owner.publicKey, 6);
    aliceX = await getOrCreateAssociatedTokenAccount(
      provider.connection, alice, mintX, alice.publicKey
    );
   
    ownerX = await getOrCreateAssociatedTokenAccount(
      provider.connection, owner, mintX, owner.publicKey
    );

    mintY = await createMint(provider.connection, owner, owner.publicKey, owner.publicKey, 6);
    aliceY = await getOrCreateAssociatedTokenAccount(
      provider.connection, alice, mintY, alice.publicKey
    );

    ownerY = await getOrCreateAssociatedTokenAccount(
      provider.connection, owner, mintY, owner.publicKey
    );


    [poolPda, ] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mintX.toBuffer(), mintY.toBuffer()],
      program.programId
    );

    poolX = await createAccount(
      provider.connection,
      owner,          
      mintX,          
      poolPda,        
      anchor.web3.Keypair.generate() 
    );
    poolY = await createAccount(
      provider.connection,
      owner,          
      mintY,          
      poolPda,        
      anchor.web3.Keypair.generate() 
    );

    await mintTo(
      provider.connection, 
      owner,            
      mintX,            
      aliceX.address,  
      owner.publicKey,  
      amount,           
    );
 
    await mintTo(
      provider.connection, 
      owner,            
      mintX,            
      ownerX.address,  
      owner.publicKey,  
      amount,           
    );

    await mintTo(
      provider.connection, 
      owner,            
      mintY,            
      aliceY.address,  
      owner.publicKey,  
      amount,           
    );

    await mintTo(
      provider.connection, 
      owner,            
      mintY,            
      ownerY.address,  
      owner.publicKey,  
      amount,           
    );
  });

  it("Is initialized!", async () => {
    const info = await provider.connection.getAccountInfo(poolPda);
    if (!info) {

      const context = {
        pool: poolPda,
        tokenX: mintX,
        tokenY: mintY,
        payer: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      };


      const tx = await program.methods.initializePool(owner.publicKey, new anchor.BN(fee)).accounts(context).signers([owner]).rpc();

      const poolAccount = await program.account.liquidityPool.fetch(poolPda);

      expect(poolAccount.authority.toBase58()).to.equal(owner.publicKey.toBase58());
      expect(poolAccount.xMint.toBase58()).to.equal(mintX.toBase58());
      expect(poolAccount.yMint.toBase58()).to.equal(mintY.toBase58());


      [lpMintPda] = await anchor.web3.PublicKey.findProgramAddressSync(
        [poolPda.toBuffer()], 
        program.programId
      );
      ownerLp = await getOrCreateAssociatedTokenAccount(
        provider.connection, owner, lpMintPda, owner.publicKey
      );      
  
      expect(poolAccount.tokenAmountX.toNumber()).to.equal(0);
      expect(poolAccount.tokenAmountY.toNumber()).to.equal(0);
      expect(poolAccount.lpSupply.toNumber()).to.equal(0);
      expect(poolAccount.fee.toNumber()).to.equal(10);
    } else {
      console.log("Pool already initialized");
    }
  });


  it("Add Liquidity", async () => {
    const balancesBefore = await  checkBalances(
      provider, 
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );

    const context = {
      pool: poolPda,
      userX: ownerX.address,
      userY: ownerY.address,
      userLp: ownerLp.address,
      lpMint: lpMintPda,
      poolX: poolX,
      poolY: poolY,
      user: owner.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    const balance = await provider.connection.getBalance(owner.publicKey);

    const amountX = amount/2;
    const amountY = amount/2;
 
    getContext(context);


    const tx = await program.methods
      .addLiquidity(new anchor.BN(amountX), new anchor.BN(amountY))
      .accounts(context)
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    lpSupply = Math.floor(Math.sqrt(amountX*amountY));
    
    const poolAccount = await program.account.liquidityPool.fetch(poolPda);
    expect(poolAccount.tokenAmountX.toNumber()).to.equal(amountX);
    expect(poolAccount.tokenAmountY.toNumber()).to.equal(amountY);
    expect(poolAccount.lpSupply.toNumber()).to.equal(lpSupply);
    expect(poolAccount.fee.toNumber()).to.equal(10);

    poolX_A = balancesBefore['poolX'] + amountX/(10**6);
    poolY_A = balancesBefore['poolY'] + amountY/(10**6);

    await checkDifferenceAfter(
      balancesBefore, 
      {
        ownerX: -amountX, 
        ownerY: -amountY, 
        poolX: amountX, 
        poolY: amountY, 
        ownerLp: lpSupply,
        aliceX: 0,
        aliceY: 0
      }, 
      provider,
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );
  });


  it("Swap X for Y", async () => {

    const balancesBefore = await checkBalances(
      provider, 
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );


    const amountX = amount/4;
    const FEE = amountX * 10 / 10000;
    const amountX_after_fee = amountX - FEE;
    const amountY = (poolY_A*10**6 * amountX_after_fee) / (poolX_A*10**6 + amountX_after_fee);


    await approve(
      provider.connection,
      alice,
      aliceX.address,
      poolPda,
      alice.publicKey,
      amountX
    );

    const context = {
      pool: poolPda,
      userX: aliceX.address,
      userY: aliceY.address,     
      poolX: poolX,
      poolY: poolY,
      user: alice.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    getContext(context);



    const tx = await program.methods
      .swapXForY(new anchor.BN(amountX))
      .accounts(context)
      .signers([alice])
      .rpc({ commitment: "confirmed" });

    poolX_A = balancesBefore['poolX'] + amountX;
    poolY_A = balancesBefore['poolY'] - amountY;

    await checkDifferenceAfter(
      balancesBefore, 
      {
        ownerX: 0, 
        ownerY: 0, 
        poolX: amountX, 
        poolY: -amountY, 
        ownerLp: 0,
        aliceX: -amountX,
        aliceY: amountY
      }, 
      provider,
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );

  });
 
  it("Swap Y for X", async () => {

    const balancesBefore = await checkBalances(
      provider, 
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );

    const amountY = amount / 10;
    const FEE = amountY * 10 / 10000;
    const amountY_after_fee = amountY - FEE;
    const amountX = (poolX_A * amountY_after_fee) / (poolY_A + amountY_after_fee);

    await approve(
      provider.connection,
      alice,
      aliceY.address,
      poolPda,
      alice.publicKey,
      amountY
    );

    const context = {
      pool: poolPda,
      userX: aliceX.address,
      userY: aliceY.address,     
      poolX: poolX,
      poolY: poolY,
      user: alice.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    getContext(context);

    const tx = await program.methods
      .swapYForX(new anchor.BN(amountY))
      .accounts(context)
      .signers([alice])
      .rpc({ commitment: "confirmed" });

    poolX_A = balancesBefore['poolX'] - amountX;
    poolY_A = balancesBefore['poolY'] + amountY;

    await checkDifferenceAfter(
      balancesBefore, 
      {
        ownerX: 0, 
        ownerY: 0, 
        poolX: -amountX, 
        poolY: amountY, 
        ownerLp: 0,
        aliceX: amountX,
        aliceY: -amountY
      }, 
      provider,
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );
  });



  it("Remove Liquidity", async () => {

    const balancesBefore = await checkBalances(
      provider, 
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );

    const amountLp = lpSupply / 2;
    const amountX = (amountLp * poolX_A) / lpSupply;
    const amountY = (amountLp * poolY_A) / lpSupply;

    await approve(
      provider.connection,
      owner,
      ownerLp.address,
      poolPda,
      owner.publicKey,
      amountLp
    );

    const context = {
      pool: poolPda,
      userLp: ownerLp.address,
      userX: ownerX.address,
      userY: ownerY.address,  
      lpMint: lpMintPda,
      poolX: poolX,
      poolY: poolY,
      user: owner.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    };


    getContext(context);

    const tx = await program.methods
      .removeLiquidity(new anchor.BN(amountLp))
      .accounts(context)
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    poolX_A = balancesBefore['poolX'] - amountX;
    poolY_A = balancesBefore['poolY'] - amountY;

    await checkDifferenceAfter(
      balancesBefore, 
      {
        ownerX: amountX, 
        ownerY: amountY, 
        poolX: -amountX, 
        poolY: -amountY, 
        ownerLp: -amountLp,
        aliceX: 0,
        aliceY: 0
      }, 
      provider,
      ownerX, 
      ownerY, 
      ownerLp,
      poolX, 
      poolY,
      aliceX,
      aliceY
    );

    const poolAccount = await program.account.liquidityPool.fetch(poolPda);

    expect(poolAccount.authority.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(poolAccount.xMint.toBase58()).to.equal(mintX.toBase58());
    expect(poolAccount.yMint.toBase58()).to.equal(mintY.toBase58());
    expect(poolAccount.tokenAmountX.toNumber()).to.equal(Math.floor(poolX_A));
    expect(poolAccount.tokenAmountY.toNumber()).to.equal(Math.floor(poolY_A));
    expect(poolAccount.lpSupply.toNumber()).to.equal(amountLp);
    expect(poolAccount.fee.toNumber()).to.equal(10);
  });


});
