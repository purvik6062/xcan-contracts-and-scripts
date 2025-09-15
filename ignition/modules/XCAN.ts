import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("XCANModule", (m) => {
  const deployer = m.getAccount(0);

  // Optional: pass a specific minter or default to deployer
  const minter = m.getParameter("minter", deployer);

  const xcan = m.contract("XCAN", [deployer, minter]);

  return { xcan };
});
