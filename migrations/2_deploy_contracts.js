var TrueDeckBlackJack = artifacts.require("./TrueDeckBlackJack.sol");

module.exports = function(deployer) {
  deployer.deploy(TrueDeckBlackJack);
};
