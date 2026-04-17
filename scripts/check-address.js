async function main() {
  const accounts = await ethers.getSigners();
  console.log("Deployer address:", await accounts[0].getAddress());
}
main();
