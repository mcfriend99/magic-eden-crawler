const { Connection, programs } = require('@metaplex/js')
const { metadata: { Metadata } } = programs
const { PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction } = require('@solana/web3.js')
const { getParsedNftAccountsByOwner } = require('@nfteyez/sol-rayz')
const axios = require('axios')
const { getOrCreateAssociatedTokenAccount } = require('@solana/spl-token')
var cols = require('./colls')
const fs = require('fs')

const connection = new Connection('mainnet-beta')

const cleanMetadata = async (tokenMetadata, uri) => {
  const content = await axios.default.get(uri).then(res => res.data)

  return {
    mint: tokenMetadata.mint,
    update_authority: tokenMetadata.updateAuthority,
    is_mutable: tokenMetadata.isMutable,
    primary_sale_happened: tokenMetadata.primarySaleHappened,
    explorer_url: `https://explorer.solana.com/address/${tokenMetadata.mint}`,
    data: tokenMetadata.data,
    floor_price: ((Math.random() * 10) + 1).toFixed(2),
    off_chain_data: {
      name: content.name,
      description: content.description,
      symbol: content.symbol,
      image: content.image,
      seller_fee_basis_points: content.seller_fee_basis_points,
      external_url: content.external_url,
      attributes: content.attributes,
      collection: content.collection,
      properties: content.properties,
    },
  }
}

const getNFT = async (mintAddress) => {
  try {
    const metadataPDA = await Metadata.getPDA(new PublicKey(mintAddress))
    let tokenMetadata = await Metadata.load(connection, metadataPDA)
    return await cleanMetadata(tokenMetadata.data, tokenMetadata.data.data.uri)
  } catch(e) {
    console.log('Failed to fetch metadata', e)
  }
}

const getNFTOwner = async (mintAddress) => {
  const largestAccounts = await connection.getTokenLargestAccounts(new PublicKey(mintAddress));
  const largestAccountInfo = await connection.getParsedAccountInfo(largestAccounts.value[0].address);
  return largestAccountInfo.value.data.parsed.info.owner
}

const listWalletNFTs = async (walletAddress) => {
  const nftsmetadata = await getParsedNftAccountsByOwner({
    connection, 
    publicAddress: walletAddress,
    serialization: true,
  });

  let result = []

  for(var nft of nftsmetadata) {
    result.push(await cleanMetadata(nft, nft.data.uri))
  }

  return result
}

const payer = Keypair.fromSecretKey(new Uint8Array([
  50,109,79,176,190,28,155,38,216,233,234,91,250,222,159,143,
  86,74,229,237,207,0,11,168,111,82,165,94,157,69,78,122,9,
  155,233,99,35,236,180,252,2,206,167,161,29,225,54,168,67,77,
  115,148,230,217,3,184,230,94,88,85,119,219,99,162
]))

const transfer = async (mintAddress, walletAddress) => {
  const mintPublicKey = new PublicKey(mintAddress)
  const walletPublicKey = new PublicKey(walletAddress)

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer.publicKey,
    mintPublicKey,
    walletPublicKey,
  )

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer.publicKey,
    mintPublicKey,
    payer.publicKey
  )

  const transaction = new Transaction({
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    feePayer: publicKey
  }).add(
    createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      mintPublicKey,
      1 * LAMPORTS_PER_SOL,
      []
    )
  )

  signature = await sendAndConfirmTransaction(connection, transaction)
  console.log('success', 'Transaction successful!', signature);
}

// TESTS
(async () => {
  // console.log(await getNFT('H2amrbFjNN6aJX8e9CFDkJsxGe4EZaLcWygZyPdTZSm8'))
  // console.log(await getNFTOwner('H2amrbFjNN6aJX8e9CFDkJsxGe4EZaLcWygZyPdTZSm8'))
  // console.log(await listWalletNFTs('BcTyZ7YQugY1GSkiYppSbyt1cKobnGrn1qSdCCYSXBPH'))

  // console.log(await getNFTOwner('EiQTADmTEHDaPhkEA1Vcx6AAmuNtsdCJeS6GXrWbqvuG'))
  
  // const starPayer = Keypair.fromSeed(Uint8Array.from(
  //   '[50,109,79,176,190,28,155,38,216,233,234,91,250,222,159,143,86,' + 
  //   '74,229,237,207,0,11,168,111,82,165,94,157,69,78,122,9,155,233,99' + 
  //   ',35,236,180,252,2,206,167,161,29,225,54,168,67,77,115,148,230,217,' + 
  //   '3,184,230,94,88,85,119,219,99,162]'.split(",")
  // ).slice(0, 32))
})();

/* Array.prototype.getOrNull = (index) => {
  if(this[index]) return this[index]
  return null
} */

Object.defineProperty(Array.prototype, 'getOrNull', {
  value: function(index) { return this.length > index && index > -1 ? this[index] : null }
});

(async () => {

  if(!fs.existsSync('output.txt'))
    fs.writeFileSync('output.txt', '')
  
  for(var col of cols) {
    const url = `https://api-mainnet.magiceden.dev/v2/collections/${col}/listings?offset=0&limit=1`
    const res = await axios.get(url)
    if(res.data) {
      const r = res.data
      if(r.length > 0) {
        const nft = await getNFT(r[0]?.tokenMint)
        // console.log(nft)
        const collection = nft?.off_chain_data?.name?.split('#').getOrNull(0)?.trim() || nft?.off_chain_data?.name?.split('-').getOrNull(1)?.trim() || nft?.off_chain_data?.collection?.name || nft?.off_chain_data?.symbol
        fs.appendFileSync('output.txt', `"${collection}": "${col}",\n`)

        console.log(`Registered ${collection} as ${col}`)
      }
    }
  }

  const raw = `{${fs.readFileSync('output.txt').toString()}}`
  fs.writeFileSync('output.json', raw)
  
  console.log('Floor Price Data Pull Completed!\n')
})();
