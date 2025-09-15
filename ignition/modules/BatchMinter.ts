import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BatchMinterModule", (m) => {
  // Deployer account as initial owner by default
  const deployer = m.getAccount(0);

  // Require the already-deployed NFT contract address
  //   const nftAddress = m.getParameter("nftAddress");
  const nftAddress = "0xbdc4efc1760D27270e50aB4456ef96cfc2d60777";

  const batchMinter = m.contract("BatchMinter", [deployer, nftAddress]);

  return { batchMinter };
});

//0xf142023900f172EA1D2163fBfeEe9AfF5adD0f40
