App = {
  web3Provider: null,
  contracts: {},
  state: {},

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    // Initialize web3 and set the provider to the testRPC.
    var web3 = window.web3;
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // If no injected web3 instance is detected, fallback to Ganache.
      App.web3Provider = new web3.providers.HttpProvider('http://127.0.0.1:7545');
      web3 = new Web3(App.web3Provider);
    }

    return App.initContract();
  },

  initContract: function() {
    $.getJSON('TrueDeckBlackJack.json', function(data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract.
      var TrueDeckBlackJackArtifact = data;
      App.contracts.TrueDeckBlackJack = TruffleContract(TrueDeckBlackJackArtifact);

      // Set the provider for our contract.
      App.contracts.TrueDeckBlackJack.setProvider(App.web3Provider);

      // Setting initial State
      App.state = {
          blockCursor: 0,
          totalEvents: -1,
          eventLogs: [],
          web3: null,
          blackjack: null,

          gameID: null,
          blockNumber: null,
          round: null,
          stage: 0,
          dealerScore: 0,
          dealerHand: null,
          playerScore: 0,
          playerHand: null,

          betValue: 0,
          result: null
      };

      App.updateView();

      // Use our contract to retieve and mark the adopted pets.
      return App.instantiateContract();
    });

    return App.bindEvents();
  },

  instantiateContract: function() {
    let blackjackInstance;
    App.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
        blackjackInstance = instance;
        console.log("Starting...");
        console.log("Getting existing game round's block number...");
        return instance.getRoundBlockNumber.call();
    }).then(function(blockNumber) {
        blockNumber = blockNumber.toNumber();
        console.log("block number: " + blockNumber);
        if (blockNumber === 0) {
            web3.eth.getBlockNumber(function(error, currentBlockNumber) {
                console.log("watching events from block number: " + currentBlockNumber);
                blackjackInstance.allEvents({fromBlock: currentBlockNumber, toBlock: 'latest'})
                    .watch(function(error, eventLog) {
                        App.watchEvents(error, eventLog);
                    });
            });
        } else {
            console.log("watching events from block number: " + blockNumber);
            blackjackInstance.allEvents({fromBlock: blockNumber, toBlock: 'latest'})
                .watch(function(error, eventLog) {
                    App.watchEvents(error, eventLog);
                });
        }
    });
  },

  bindEvents: function() {
    $(document).on('click', '#sitdown', App.sitDown);
    $(document).on('click', '#deal', App.deal);
    $(document).on('click', '#hit', App.hit);
    $(document).on('click', '#stand', App.stand);
    $(document).on('change', '#betvalue', App.handleBetChange);
  },

  watchEvents: function(error, eventLog) {
      if (error) {
          console.log(error);
      } else {
          if (App.state.blockCursor >= eventLog.blockNumber) {
              console.log("-- processed event " + eventLog.event);
              return;
          }

          if (eventLog.event === "ProcessEvents") {
              App.state.totalEvents = eventLog.logIndex + 1;
          }

          let newEventLogs = App.state.eventLogs.slice();
          newEventLogs.splice(eventLog.logIndex, 0, eventLog);
          App.state.eventLogs = newEventLogs;

          if (App.state.eventLogs.length === App.state.totalEvents) {
              let prevEventLogs = App.state.eventLogs.slice();
              App.state.totalEvents = -1;
              App.state.eventLogs = [];
              App.state.blockCursor = eventLog.blockNumber;
              App.processEvents(prevEventLogs);
          }
      }
  },

  processEvents: function(eventLogs) {
      console.log("************** Processing Event Logs **************");
      while (eventLogs.length !== 0) {
          let eventLog = eventLogs.shift();
          App.processEvent(eventLog);
      }
  },

  processEvent: function(eventLog) {
      console.log("===== " + eventLog.event + " =====");

      switch (eventLog.event) {
          case "StageChanged":
              console.log("#:     " + eventLog.logIndex);
              console.log("ID:    " + eventLog.args.gameId);
              console.log("round: " + eventLog.args.round.toNumber());
              console.log("stage: " + App.getStage(eventLog.args.newStage.toNumber()));
              break;

          case "NewRound":
              console.log("#:       " + eventLog.logIndex);
              console.log("ID:      " + eventLog.args.gameId);
              console.log("round:   " + eventLog.args.round.toNumber());
              console.log("address: " + eventLog.args.player);
              console.log("bet:     " + eventLog.args.bet.toNumber());
              break;

          case "CardDrawn":
              console.log("#:        " + eventLog.logIndex);
              console.log("ID:       " + eventLog.args.gameId);
              console.log("round:    " + eventLog.args.round.toNumber());
              console.log("card:     " + eventLog.args.card.toNumber());
              console.log("score:    " + eventLog.args.score.toNumber());
              console.log("isDealer: " + eventLog.args.isDealer);
              break;

          case "Result":
              let dealerScore = eventLog.args.dealerScore.toNumber();
              let playerScore = eventLog.args.playerScore.toNumber();
              let payout = eventLog.args.payout.toNumber();

              console.log("#:      " + eventLog.logIndex);
              console.log("ID:     " + eventLog.args.gameId);
              console.log("round:  " + eventLog.args.round.toNumber());
              console.log("payout: " + payout);
              console.log("pscore: " + playerScore);
              console.log("dscore: " + dealerScore);

              let r = ((payout !== 0) ? "You Won" : "You Lose")
                + ", round: " + eventLog.args.round.toNumber()
                + ", payout: " + eventLog.args.payout.toNumber()
                + ", pscore: " + playerScore
                + ", dscore: " + dealerScore;
              App.state.result = r;
              $('#result').text(App.state.result);
              break;

          case "ProcessEvents":
              console.log("#:     " + eventLog.logIndex);
              console.log("ID:    " + eventLog.args.gameId);
              console.log("round: " + eventLog.args.round.toNumber());
              console.log("************** All Events Processed **************");

              App.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
                  return instance.getGameState.call()
              }).then(function(result) {
                  console.log("===== Game State =====");
                  console.log("ID:          " + result[0]);
                  console.log("blockNumber:   " + result[1].toNumber());
                  console.log("round:       " + result[2].toNumber());
                  console.log("stage:       " + App.getStage(result[3].toNumber()));
                  console.log("dealerScore: " + result[4].toNumber());
                  console.log("dealerHand:   [" + result[5] + "]");
                  console.log("playerScore: " + result[6].toNumber());
                  console.log("playerHand:   [" + result[7] + "]");
                  console.log("*-*-*-*-*-*-*-* FINISH *-*-*-*-*-*-*-*");
                  console.log("\n\n\n");

                  App.state.gameID = result[0];
                  App.state.blockNumber = result[1].toNumber();
                  App.state.round = result[2].toNumber();
                  App.state.stage = result[3].toNumber();
                  App.state.dealerScore = result[4].toNumber();
                  App.state.dealerHand = result[5];
                  App.state.playerScore = result[6].toNumber();
                  App.state.playerHand = result[7];

                  App.updateView();
              });
              break;

         default:
            console.log("Event not recognized!");
      }
  },

  handleBetChange: function(event) {
      App.state.betValue = event.target.value;
  },

  sitDown: function() {
      console.log("===== sitDown =====");
      web3.eth.getAccounts((error, accounts) => {
          App.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.initGame(23434, {from: accounts[0]});
          }).then(function(result) {
              console.log(result);
          });
      });
  },

  deal: function() {
      console.log("===== deal =====");
      web3.eth.getAccounts((error, accounts) => {
          App.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.newRound(0x3d10bc4234567676448503e68508a5d3, {from: accounts[0], value: 3000000000000000000});
          }).then(function(result) {
              console.log(result);
          });
      });
  },

  hit: function() {
      console.log("===== hit =====");
      web3.eth.getAccounts((error, accounts) => {
          App.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.hit(0x3d10bc4234567676448503e68508a5d3, {from: accounts[0]});
          }).then(function(result) {
              console.log(result);
          });
      });
  },

  stand: function() {
      console.log("===== stand =====");
      web3.eth.getAccounts((error, accounts) => {
          App.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.stand(0x3d10bc4234567676448503e68508a5d3, {from: accounts[0]});
          }).then(function(result) {
              console.log(result);
          });
      });
  },

  getStage: function(stage) {
      switch (stage) {
          case 0: return "SitDown";
          case 1: return "Bet";
          case 2: return "Play";
          default: return "default";
      }
  },

  updateView: function() {
      if (App.state.stage === 0) {
          $('#sit-down-div').show();
          $('#deal-div').hide();
          $('#hit-stand-div').hide();
      } else if (App.state.stage === 1) {
          $('#sit-down-div').hide();
          $('#deal-div').show();
          $('#hit-stand-div').hide();
      } else if (App.state.stage === 2) {
          $('#sit-down-div').hide();
          $('#deal-div').hide();
          $('#hit-stand-div').show();
      }

      $('#gameID').text(App.state.gameID);
      $('#blockNumber').text(App.state.blockNumber);
      $('#round').text(App.state.round);
      $('#stage').text(App.state.stage);
      $('#dealerScore').text(App.state.dealerScore);
      $('#dealerHand').text(App.state.dealerHand);
      $('#playerScore').text(App.state.playerScore);
      $('#playerHand').text(App.state.playerHand);
  }
};

$(function() {
  window.addEventListener('load', function() {
    App.init();
  });
});
