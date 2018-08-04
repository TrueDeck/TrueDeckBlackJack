module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id
    },
    gochain: {
      host: "https://testnet-rpc.gochain.io/",
      port: 443,
      network_id: "*" // Match any network id
    }
  }
};
