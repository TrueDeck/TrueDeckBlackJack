function CGame(oData){
    const TEST_SEED = "TEST SEED FOR BLACKJACK";

    DApp = {
      web3Provider: null,
      web3: null,
      contracts: {},
      state: {},
      game: null,

      init: function(s_oGame) {
        DApp.game = s_oGame;
        log.setLevel("debug");
        return DApp.initWeb3();
      },

      initWeb3: function() {
        if (typeof web3 !== 'undefined') {
          DApp.web3Provider = window.web3.currentProvider;
          DApp.web3 = new Web3(DApp.web3Provider);
          log.debug("Web3 initialized. Window web3 version = " + window.web3.version.api + ", DApp web3 Version = " + DApp.web3.version);
        } else {
          log.error("No web wallet found! Please use MetaMask!");
        }

        return DApp.initContract();
      },

      initContract: function() {
        $.getJSON('TrueDeckBlackJack.json', function(data) {
          // Get the necessary contract artifact file and instantiate it with truffle-contract.
          var TrueDeckBlackJackArtifact = data;
          DApp.contracts.TrueDeckBlackJack = TruffleContract(TrueDeckBlackJackArtifact);

          // Set the provider for our contract.
          DApp.contracts.TrueDeckBlackJack.setProvider(DApp.web3Provider);

          log.debug("Getting accounts:");
          DApp.web3.eth.getAccounts(function(error, accounts) {
              log.debug("Using accounts[0]: " + accounts[0]);

              // Setting initial State
              DApp.state = {
                  account: accounts[0],
                  round: null,
                  stage: 0,
                  cardSeed: null,
                  callback: null
              };

              DApp.instantiateContract();
          });
        });
      },

      instantiateContract: function() {
        var blackjackInstance;
        log.debug("Starting...");
        log.debug("Checking if contract has deployed!");
        DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
            blackjackInstance = instance;
            log.debug("Checking for existing game round's start block!");
            return instance.getRoundBlockNumber.call();
        }).then(function(blockNumber) {
            blockNumber = blockNumber.toNumber();
            if (blockNumber === 0) {
                log.debug("No game found!");
                log.debug("Getting current block number!");
                DApp.web3.eth.getBlockNumber(function(error, currentBlockNumber) {
                    log.debug("Watching events from current block#" + currentBlockNumber);
                    blackjackInstance.allEvents({fromBlock: currentBlockNumber, toBlock: 'latest'})
                        .watch(function(error, eventLog) {
                            if (eventLog.args.player && DApp.state.account
                                && eventLog.args.player.toLowerCase() === DApp.state.account.toLowerCase()) {
                                DApp.watchEvents(error, eventLog);
                            }
                        });
                });
            } else {
                log.debug("Game already created!");
                log.debug("Watching events from round start block#" + blockNumber);
                blackjackInstance.allEvents({fromBlock: blockNumber, toBlock: 'latest'})
                    .watch(function(error, eventLog) {
                        if (eventLog.args.player && DApp.state.account
                            && eventLog.args.player.toLowerCase() === DApp.state.account.toLowerCase()) {
                            DApp.watchEvents(error, eventLog);
                        }
                    });
            }
        });
      },

      watchEvents: function(error, eventLog) {
          if (error) {
              log.debug("Event error: " + error);
          } else {
              log.debug("Event received: " + eventLog.event);
              switch (eventLog.event) {
                    case "GameCreated":
                        log.debug("New game has been created for account: " + DApp.state.account);
                        if (DApp.state.callback) {
                            DApp.state.callback();
                        }
                        break;

                    case "NewRound":
                        log.debug("Round #" + eventLog.args.round.toNumber() + " started with bet amount: " + eventLog.args.bet.toNumber());
                        break;

                    case "StageChanged":
                        log.debug("Round #" + eventLog.args.round.toNumber() + " stage changed: " + DApp.getStage(eventLog.args.newStage.toNumber()));
                        break;

                    case "BlockElected":
                        var electedBlockNumber = eventLog.args.blockNumber.toNumber();
                        log.debug("Block Elected: " + electedBlockNumber);

                        log.debug("Getting BlockHeader of Block #" + electedBlockNumber);
                        window.web3.eth.getBlock(electedBlockNumber, function(error, blockHeader) {
                            log.debug("Block #" + blockHeader.number + " Hash = " + blockHeader.hash);
                            DApp.state.cardSeed = DApp.web3.utils.toBN(DApp.web3.utils.soliditySha3(TEST_SEED, blockHeader.hash));
                            log.debug("Card Seed Generated: " + DApp.state.cardSeed);
                            if (DApp.state.callback) {
                                 DApp.state.callback();
                            }
                        });
                        break;

                    case "Result":
                        log.debug("Round #" + eventLog.args.round.toNumber() + ", PScore:" + eventLog.args.playerScore.toNumber() + ", DScore:" + eventLog.args.dealerScore.toNumber() + ", Payout:" + eventLog.args.payout.toNumber() + ", Credits:" + eventLog.args.credits.toNumber());
                        DApp.game.setCredit(eventLog.args.credits.toNumber());
                        DApp.game.enableBetFiches();
                        DApp.game.enableButtons(true,false,false,false,false);
                        break;

                    case "Info":
                        log.debug("Info #" + eventLog.args.code + ": " + eventLog.args.message);
                        break;

                    case "Error":
                        log.debug("Error #" + eventLog.args.code + ": " + eventLog.args.message);
                        break;
              }
          }
      },

      sitDown: function(callback) {
          log.info("Action: SitDown, waiting for TX to be mined.");
          DApp.state.callback = callback;

          DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.initGame({from: DApp.state.account});
          }).then(function(result) {
              log.info("TX mined.");
              console.log(result);
          }).catch((err) => {
              log.error("Action: SitDown Failed!" + err);
              DApp.game.showSitDownButton();
          });
      },

      deal: function(betValue, callback) {
          log.info("Action: Deal, waiting for TX to be mined.");
          DApp.state.callback = callback;
          DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.newRound(TEST_SEED, betValue, {from: DApp.state.account});
          }).then(function(result) {
              log.info("TX mined.");
              console.log(result);
          }).catch((err) => {
              log.error("Action: Deal Failed!" + err);
              DApp.game.enableBetFiches();
              DApp.game.enableButtons(true,false,false,false,false);
          });
      },

      hit: function(callback) {
          log.info("Action: Hit, waiting for TX to be mined.");
          DApp.state.callback = callback;
          DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.hit({from: DApp.state.account});
          }).then(function(result) {
              log.info("TX mined.");
              console.log(result);
          }).catch((err) => {
              log.error("Action: Hit Failed!" + err);
              DApp.game.enableButtons(false,true,true,false,false);
          });
      },

      stand: function(callback) {
          log.info("Action: Stand, waiting for TX to be mined.");
          DApp.state.callback = callback;
          DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.stand({from: DApp.state.account});
          }).then(function(result) {
              log.info("TX mined.");
              console.log(result);
          }).catch((err) => {
              log.error("Action: Stand Failed!" + err);
              DApp.game.enableButtons(false,true,true,false,false);
          });
      },

      claim: function() {
          log.info("Action: Claim, waiting for TX to be mined.");
          DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
              return instance.claim(TEST_SEED, {from: DApp.state.account});
          }).then(function(result) {
              log.info("TX mined.");
              console.log(result);
          }).catch((err) => {
              log.error("Action: Claim Failed!" + err);
              DApp.game.enableButtons(false,false,false,true,false);
          });
      },

      getStage: function(stage) {
          switch (stage) {
              case 0: return "SitDown";
              case 1: return "Bet";
              case 2: return "Play";
              default: return "default";
          }
      }
    };

    var _bUpdate = false;
    var _bPlayerTurn;
    var _bSplitActive;
    var _bDoubleForPlayer;
    var _bDealerLoseInCurHand = false;
    var _iInsuranceBet;
    var _iTimeElaps;
    var _iMaxBet;
    var _iMinBet;
    var _iState;
    var _iCardIndexToDeal;
    var _iDealerValueCard;
    var _iCardDealedToDealer;
    var _iAcesForDealer;
    var _iCurFichesToWait;
    var _iNextCardForPlayer;
    var _iNextCardForDealer;
    var _iGameCash;
    var _iAdsCounter;

    var _aCardsDealing;
    var _aCardsInCurHandForDealer;
    var _aDealerCards;
    var _aCardDeck;
    var _aCardsInCurHandForPlayer;
    var _aCurActiveCardOffset;
    var _aCardOut;
    var _aCurDealerPattern;

    var _oStartingCardOffset;
    var _oDealerCardOffset;
    var _oReceiveWinOffset;
    var _oFichesDealerOffset;
    var _oRemoveCardsOffset;
    var _oCardContainer;

    var _oBg;
    var _oInterface;
    var _oSeat;
    var _oGameOverPanel;
    var _oMsgBox;

    this._init = function(){
        _iMaxBet = MAX_BET;
        _iMinBet = MIN_BET;
        _iState = -1;
        _iTimeElaps = 0;
        _iAdsCounter = 0;

        DApp.init(s_oGame);

        s_oTweenController = new CTweenController();

        var iRandBg = Math.floor(Math.random() * 4) + 1;
        _oBg = createBitmap(s_oSpriteLibrary.getSprite('bg_game_'+iRandBg));
        s_oStage.addChild(_oBg);

        _oSeat = new CSeat();
        _oSeat.setCredit(TOTAL_MONEY);
        _oSeat.addEventListener(SIT_DOWN,this._onSitDown,this);
        _oSeat.addEventListener(RESTORE_ACTION,this._onSetPlayerActions);
        _oSeat.addEventListener(PASS_TURN,this._passTurnToDealer);
        _oSeat.addEventListener(END_HAND,this._onEndHand);
        _oSeat.addEventListener(PLAYER_LOSE,this._playerLose);

        _oCardContainer = new createjs.Container();
        s_oStage.addChild(_oCardContainer);

        _oInterface = new CInterface(TOTAL_MONEY);
        _oInterface.displayMsg(TEXT_DISPLAY_MSG_SIT_DOWN);

        this.reset(true);

        _oStartingCardOffset = new CVector2();
        _oStartingCardOffset.set(1214,228);

        _oDealerCardOffset = new CVector2();
        _oDealerCardOffset.set(788,180);

        _oReceiveWinOffset = new CVector2();
        _oReceiveWinOffset.set(418,820);

        _oFichesDealerOffset = new CVector2();
        _oFichesDealerOffset.set(CANVAS_WIDTH/2,-100);

        _oRemoveCardsOffset = new CVector2(408,208);

        _aCurActiveCardOffset=new Array(_oSeat.getCardOffset(),_oDealerCardOffset);

        _oInterface.disableBetFiches();
    	_oGameOverPanel = new CGameOver();
    	_oMsgBox = new CMsgBox();

        if (_oSeat.getCredit()<s_oGameSettings.getFichesValueAt(0)){
                    this._gameOver();
                    this.changeState(-1);
        } else {
            _bUpdate = true;
        }


    };

    this.unload = function(){
	_bUpdate = false;

        for (var i=0;i<_aCardsDealing.length;i++){
            _aCardsDealing[i].unload();
        }

        var aCards=_oSeat.getPlayerCards();
        for (var k=0;k<aCards.length;k++){
                aCards[k].unload();
        }

        _oInterface.unload();
        _oGameOverPanel.unload();
        _oMsgBox.unload();
        s_oStage.removeAllChildren();
    };

    this.reset = function(bFirstPlay){
        _bPlayerTurn=true;
        _bSplitActive=false;
        _bDoubleForPlayer=false;
        _iInsuranceBet=0;
        _iTimeElaps=0;
        _iCardIndexToDeal=0;

        _iDealerValueCard=0;
        _iCardDealedToDealer=0;
        _iAcesForDealer=0;
        _iCurFichesToWait=0;
        _oSeat.reset();

        _aCardsDealing=new Array();
        _aCardsDealing.splice(0);

        _aDealerCards=new Array();
        _aDealerCards.splice(0);

        _oInterface.reset();
        _oInterface.enableBetFiches();


        _aCardsInCurHandForPlayer=new Array();
        _aCardsInCurHandForDealer=new Array();
        _aCardDealingOrder=new Array();
        _iNextCardForPlayer=0;
        _iNextCardForDealer=0;

        _aCardOut = new Array();
        for (var k=0;k<52*2;k++){
            _aCardOut[k] = 0;
        }
    };

    this.changeState = function(iState){
        _iState=iState;

        switch(_iState){
            case STATE_GAME_DEALING:{
                _oInterface.disableButtons();
                _oInterface.displayMsg(TEXT_DISPLAY_MSG_DEALING);
                this._dealing();
                break;
            }
        }
    };

    this._checkIfDealerPatternCanBeUsed = function(aTmpDealerPattern){
        for (var i=0;i<aTmpDealerPattern.length;i++){
            if (_aCardOut[aTmpDealerPattern[i]] > 1){
                return false;
            }
        }

        return true;
    };

    this.attachCardToDeal = function(pStartingPoint,pEndingPoint,bDealer,iCardCount){
            var oCard = new CCard(_oStartingCardOffset.getX(),_oStartingCardOffset.getY(),_oCardContainer);
            var iCard;
            if (bDealer){
                // DEALER CARDS
                 iCard = _aCardsInCurHandForDealer[_iNextCardForDealer];
                _iNextCardForDealer++;

                oCard.setInfo(pStartingPoint,pEndingPoint,iCard,s_oGameSettings.getCardValue(iCard),bDealer,iCardCount);
                _aCardOut[iCard] += 1;
            } else {
                // PLAYER CARDS
                iCard = _aCardsInCurHandForPlayer[_iNextCardForPlayer];
                _iNextCardForPlayer++;

                oCard.setInfo(pStartingPoint,pEndingPoint,iCard,s_oGameSettings.getCardValue(iCard),bDealer,iCardCount);
                _aCardOut[iCard] += 1;
            }

            oCard.addEventListener(ON_CARD_ANIMATION_ENDING,this.cardFromDealerArrived);

            _aCardsDealing.push(oCard);

            if (DISABLE_SOUND_MOBILE === false || s_bMobile === false){
                playSound("card", 1, 0);
            }
    };

    this.cardFromDealerArrived = function(oCard,bDealerCard,iCount){
        for (var i=0;i<_aCardsDealing.length;i++){
                if (_aCardsDealing[i] === oCard){
                        _aCardsDealing.splice(i,1);
                        break;
                }
        }

        if (bDealerCard === false){
            _oSeat.addCardToHand(oCard);
            _oSeat.increaseHandValue(oCard.getValue());
            if (iCount>2){
                _oSeat.refreshCardValue();
            }
        } else {
            var dealerCardValue = oCard.getValue();
            if (dealerCardValue) {
                _iDealerValueCard += dealerCardValue;
            }
            if (_iCardDealedToDealer > 2){
                _oInterface.refreshDealerCardValue(_iDealerValueCard);
            }
            if (oCard.getValue() === 11){
                _iAcesForDealer++;
            }

            _aDealerCards.push(oCard);
        }

        if (iCount<3){
                s_oGame._dealing();
        } else {

                s_oGame._checkHand();
                if ( bDealerCard === false && _bDoubleForPlayer){
                    _bDoubleForPlayer = false;
                    s_oGame._onStandPlayer();
                }
        }
    };

    this._onStandPlayer = function(){
        _oSeat.stand();
    };
    this._checkHand = function() {
        var i;

        if (_bPlayerTurn) {
            _oSeat.checkHand();
        } else {
            _oInterface.refreshDealerCardValue(_iDealerValueCard);
            if (_iDealerValueCard === 21) {
                if (_iInsuranceBet > 0 && _aDealerCards.length === 2) {
                    _oSeat.increaseCredit((_iInsuranceBet * 2));
                    _iGameCash -= (_iInsuranceBet * 2);

                    _oInterface.refreshCredit(_oSeat.getCredit());

                    for (i = 0; i < _oSeat.getNumHands(); i++) {
                        this._playerLose(i);
                    }
                } else {
                    for (i = 0; i < _oSeat.getNumHands(); i++) {
                        this._playerLose(i);
                    }
                }

            } else if (_iDealerValueCard > 21) {
                if (_iAcesForDealer > 0) {
                    _iAcesForDealer--;
                    _iDealerValueCard -= 10;
                    _oInterface.refreshDealerCardValue(_iDealerValueCard);
                    if (_iDealerValueCard < 17) {
                        this.hitDealer();
                    } else {
                        this._checkWinner();
                    }
                } else {
                    this._checkWinner();
                }
            } else if (_iDealerValueCard < 17) {
                this.hitDealer();
            } else {
                this._checkWinner();
            }
        }
    };

    this._playerWin = function(iHand){
        var iMult = 1;
        if (_oSeat.getHandValue(iHand) === 21 && _oSeat.getNumCardsForHand(iHand) === 2){
            iMult =  BLACKJACK_PAYOUT;
        }

        var iTotalWin = _oSeat.getBetForHand(iHand) + parseFloat((_oSeat.getBetForHand(iHand) * iMult).toFixed(2));

        _oSeat.increaseCredit(iTotalWin);
        _iGameCash -= iTotalWin;

        _oSeat.showWinner(iHand,TEXT_SHOW_WIN_PLAYER,iTotalWin);
        _oInterface.displayMsg(TEXT_DISPLAY_MSG_PLAYER_WIN);

        _oSeat.initMovement(iHand,_oReceiveWinOffset.getX(),_oReceiveWinOffset.getY());

        if (_iDealerValueCard === 21){
            _oSeat.initInsuranceMov(_oReceiveWinOffset.getX(),_oReceiveWinOffset.getY());
        } else {
            _oSeat.initInsuranceMov(_oFichesDealerOffset.getX(),_oFichesDealerOffset.getY());
        }
    };

    this._playerLose = function(iHand){
        _oSeat.showWinner(iHand,TEXT_SHOW_LOSE_PLAYER,0);
        _oInterface.displayMsg(TEXT_DISPLAY_MSG_PLAYER_LOSE);

        _oSeat.initMovement(iHand,_oFichesDealerOffset.getX(),_oFichesDealerOffset.getY());

        if (_iDealerValueCard === 21){
            _oSeat.initInsuranceMov(_oReceiveWinOffset.getX(),_oReceiveWinOffset.getY());
        } else {
            _oSeat.initInsuranceMov(_oFichesDealerOffset.getX(),_oFichesDealerOffset.getY());
        }
    };

    this.playerStandOff = function(iHand){
        _oSeat.increaseCredit(_oSeat.getBetForHand(iHand));
        _iGameCash -= _oSeat.getBetForHand(iHand);

         _oSeat.showWinner(iHand,TEXT_SHOW_STANDOFF,0);
         _oInterface.displayMsg(TEXT_DISPLAY_MSG_PLAYER_STANDOFF);

        _oSeat.initMovement(iHand,_oReceiveWinOffset.getX(),_oReceiveWinOffset.getY());

        if (_iDealerValueCard === 21){
            _oSeat.initInsuranceMov(_oReceiveWinOffset.getX(),_oReceiveWinOffset.getY());
        } else {
            _oSeat.initInsuranceMov(_oFichesDealerOffset.getX(),_oFichesDealerOffset.getY());
        }
    };

    this._dealing = function(){
        if (_iCardIndexToDeal<_aCurActiveCardOffset.length*2){
                var oCard = new CCard(_oStartingCardOffset.getX(),_oStartingCardOffset.getY(),_oCardContainer);

                var pStartingPoint = new CVector2(_oStartingCardOffset.getX(),_oStartingCardOffset.getY());
                var pEndingPoint;

                //THIS CARD IS FOR THE DEALER
                if ((_iCardIndexToDeal%_aCurActiveCardOffset.length) === 1){
                    _iCardDealedToDealer++;
                    pEndingPoint=new CVector2(_oDealerCardOffset.getX()+(CARD_WIDTH+2)*(_iCardIndexToDeal > 1?1:0),_oDealerCardOffset.getY());
                    var iCard;
                    iCard = _aCardsInCurHandForDealer[_iNextCardForDealer];

                    oCard.setInfo(pStartingPoint,pEndingPoint,iCard,s_oGameSettings.getCardValue(iCard),true,_iCardDealedToDealer);

                    _aCardOut[iCard] += 1;
                    _iNextCardForDealer++;
                    if (_iCardDealedToDealer === 2){
                            oCard.addEventListener(ON_CARD_SHOWN,this._onCardShown);
                    }
                } else {
                    pEndingPoint=_oSeat.getAttachCardOffset();
                    oCard.setInfo(pStartingPoint,pEndingPoint,_aCardsInCurHandForPlayer[_iNextCardForPlayer],
                                                    s_oGameSettings.getCardValue(_aCardsInCurHandForPlayer[_iNextCardForPlayer]),
                                                                    false,_oSeat.newCardDealed());

                    _aCardOut[_aCardsInCurHandForPlayer[_iNextCardForPlayer]] += 1;
                    _iNextCardForPlayer++;
                }

                _aCardsDealing.push(oCard);
                _iCardIndexToDeal++;


                oCard.addEventListener(ON_CARD_ANIMATION_ENDING,this.cardFromDealerArrived);
                oCard.addEventListener(ON_CARD_TO_REMOVE,this._onRemoveCard);

                if (DISABLE_SOUND_MOBILE === false || s_bMobile === false){
                    playSound("card", 1, 0);
                }
        } else {
                this._checkAvailableActionForPlayer();
        }
    };

    this.hitDealer = function(){
        var pStartingPoint=new CVector2(_oStartingCardOffset.getX(),_oStartingCardOffset.getY());
        var pEndingPoint=new CVector2(_oDealerCardOffset.getX()+((CARD_WIDTH+3)*_iCardDealedToDealer),_oDealerCardOffset.getY());
        _iCardDealedToDealer++;

        this.attachCardToDeal(pStartingPoint,pEndingPoint,true,_iCardDealedToDealer);

        this.changeState(STATE_GAME_HITTING);

        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            playSound("card", 1, 0);
        }
    };

    this._checkWinner = function(){
        for (var i=0;i<_oSeat.getNumHands();i++){
            if (_oSeat.getHandValue(i)>21){
                    this._playerLose(i);
            } else if (_iDealerValueCard>21){
                    _oInterface.enable(false,false,false,true,false);
                    this._playerWin(i);
            } else if (_oSeat.getHandValue(i)<22 && _oSeat.getHandValue(i)>_iDealerValueCard){
                    _oInterface.enable(false,false,false,true,false);
                    this._playerWin(i);
            } else if (_oSeat.getHandValue(i) === _iDealerValueCard){
                    _oInterface.enable(false,false,false,true,false);
                    this.playerStandOff(i);
            } else {
                this._playerLose(i);
            }
        }
    };

    this._onEndHand = function(){
        var pRemoveOffset=new CVector2(_oRemoveCardsOffset.getX(),_oRemoveCardsOffset.getY());

        for (var i=0;i<_aDealerCards.length;i++){
            _aDealerCards[i].initRemoving(pRemoveOffset);
            _aDealerCards[i].hideCard();
        }


        var aCards=_oSeat.getPlayerCards();
        for (var k=0;k<aCards.length;k++){
                aCards[k].initRemoving(pRemoveOffset);
                aCards[k].hideCard();
        }

        _oSeat.clearText();
        _oInterface.clearDealerText();
        _iTimeElaps=0;
        s_oGame.changeState(STATE_GAME_SHOW_WINNER);

        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            playSound("fiche_collect", 1, 0);
        }

        _iAdsCounter++;
        if (_iAdsCounter === AD_SHOW_COUNTER){
            _iAdsCounter = 0;
            $(s_oMain).trigger("show_interlevel_ad");
        }


    };

    this.ficheSelected = function(iFicheValue,iFicheIndex){
        var iCurBet=_oSeat.getCurBet();

        if ( (iCurBet+iFicheValue) <= _iMaxBet && iFicheValue <= _oSeat.getCredit() ){
            iCurBet+=iFicheValue;
            iCurBet=Number(iCurBet.toFixed(1));

            _oSeat.decreaseCredit(iFicheValue);
            _iGameCash += iFicheValue;

            _oSeat.changeBet(iCurBet);
            _oSeat.refreshFiches(iFicheValue,iFicheIndex,0,0);

            _oSeat.bet(iCurBet,false);
            _oInterface.enable(true,false,false,false,false);
            _oInterface.refreshCredit(_oSeat.getCredit());
        }
    };

    this._checkAvailableActionForPlayer = function(){
            this.changeState(-1);

            var iPlayerValueCard =_oSeat.getHandValue(0);
            //PLAYER HAVE 21 WITH FIRST 2 CARDS
            if (iPlayerValueCard === 21){
                    _oSeat.refreshCardValue();
                    this._passTurnToDealer();
                    return;
            } else if (iPlayerValueCard > 21){
                _oSeat.removeAce();
            }

            _oSeat.refreshCardValue();
            var bActivateSplit = false;

            if (_oSeat.isSplitAvailable() && _oSeat.getCredit() >= _oSeat.getCurBet()*1.5){
                    bActivateSplit=true;
            }
            _oInterface.displayMsg(TEXT_DISPLAY_MSG_YOUR_ACTION);

            var bActivateDouble=false;
            if (_oSeat.getNumCardsForHand(0) === 2 &&  _oSeat.getHandValue(0) > 8 && _oSeat.getHandValue(0) < 16 && _oSeat.getCredit() >= _oSeat.getCurBet() && !_bSplitActive){
                    bActivateDouble=true;
            }
            _oInterface.enable(false,true,true,bActivateDouble,bActivateSplit);

            //SHOW INSURANCE PANEL

            // if (_aDealerCards[0].getValue() === 11){
            //     _iInsuranceBet=_oSeat.getCurBet()/2;
            //     _oInterface.showInsurancePanel();
            // }
    };

    this._passTurnToDealer = function(){
        if (!_bPlayerTurn){
            return;
        }
        _bPlayerTurn=false;
        _oInterface.disableButtons();

        // Draw card for dealer
        s_oGame.drawCardForDealer();

        // Fetching card from dealer hand
        _iNextCardForDealer--;
         iCard = _aCardsInCurHandForDealer[_iNextCardForDealer];
        _iNextCardForDealer++;

        // Setting value to drawn dealer card
        _aDealerCards[1].setCard(iCard, s_oGameSettings.getCardValue(iCard));
        _iDealerValueCard += _aDealerCards[1].getValue();
        _aDealerCards[1].showCard();

        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            playSound("card", 1, 0);
        }

        _oInterface.displayMsg(TEXT_DISPLAY_MSG_DEALER_TURN);
    };

    this._gameOver = function(){
        _oGameOverPanel.show();
    };

    this.onFicheSelected = function(iFicheIndex,iFicheValue){
        this.ficheSelected(iFicheValue,iFicheIndex);
    };

    this._onSetPlayerActions = function(bDeal,bHit,bStand,bDouble,bSplit){
        _oInterface.enable(bDeal,bHit,bStand,bDouble,bSplit);
	    _oSeat.refreshCardValue();
    };

    this.showSitDownButton = function(){
        _oSeat.showSitDownButton();
    }

    this.hideSitDownButton = function(){
        _oSeat.showSitDownButton();
    }

    this.enableBetFiches = function(){
        s_oInterface.enableBetFiches();
    }

    this.disableBetFiches = function(){
        s_oInterface.disableBetFiches();
    }

    this.setCredit = function(credit){
        _oSeat.setCredit(credit);
    }

    this.enableButtons = function(bDealBut,bHit,bStand,bDouble,bSplit){
        s_oInterface.enable(bDealBut,bHit,bStand,bDouble,bSplit);
    }

    this._onSitDown = function(){
        DApp.sitDown(this.onSitDownComplete.bind(this));
    };

    this.onDeal = function(){
        DApp.deal(_oSeat.getCurBet(), this.onDealComplete.bind(this));
    };

    this.onHit = function(){
        DApp.hit(this.onHitComplete.bind(this));
    };

    this.onStand = function(){
        DApp.stand(this.onStandComplete.bind(this));
    };

    this.drawCard = function(isDealer) {
        log.debug("Drawing card using seed: " + DApp.state.cardSeed);

        const BN13 = DApp.web3.utils.toBN(13);
        const BN255 = DApp.web3.utils.toBN(255);
        var card = DApp.state.cardSeed.and(BN255).mod(BN13).toNumber();
        DApp.state.cardSeed = DApp.state.cardSeed.shrn(2);

        if (isDealer) {
            log.debug("Dealer Card: " + card);
            _aCardsInCurHandForDealer.push(card);
        } else {
            log.debug("Player Card: " + card);
            _aCardsInCurHandForPlayer.push(card);
        }

        return card;
    }

    this.onSitDownComplete = function(){
        this.changeState(STATE_GAME_WAITING_FOR_BET);
        DApp.contracts.TrueDeckBlackJack.deployed().then(function(instance) {
            log.debug("Getting player credits.");
            return instance.getCredits.call();
        }).then(function(credits) {
            log.debug("Setting player credits: " + credits);
            s_oGame.setCredit(credits);
        });
        _oInterface.enableBetFiches();
    };

    this.onDealComplete = function(){
        log.debug("Dealing cards");
        this.drawCard(false);
        this.drawCard(true);
        this.drawCard(false);

        if (_iMinBet>_oSeat.getCurBet()){
            _oMsgBox.show(TEXT_ERROR_MIN_BET);
            s_oInterface.enableBetFiches();
            s_oInterface.enable(true,false,false,false,false);
            return;
        }

        this.changeState(STATE_GAME_DEALING);

        $(s_oMain).trigger("bet_placed",_oSeat.getCurBet());
    };

    this.onHitComplete = function(){
        log.debug("Player card for Hit");
        this.drawCard(false);

        var pStartingPoint=new CVector2(_oStartingCardOffset.getX(),_oStartingCardOffset.getY());

        var pEndingPoint=new CVector2(_oSeat.getAttachCardOffset().getX(),_oSeat.getAttachCardOffset().getY());

        this.attachCardToDeal(pStartingPoint,pEndingPoint,false,_oSeat.newCardDealed());

        this.changeState(STATE_GAME_HITTING);
    };

    this.onStandComplete = function(){
        _oSeat.stand();
    };

    this.drawCardForDealer = function(){
        log.debug("Show Dealer card on Stand");

        var card = this.drawCard(true);
        var value = s_oGameSettings.getCardValue(card);

        var dealerScore = _iDealerValueCard;

        log.debug("Drawing dealer cards to 16...");
        while (true) {
            if (value === 11 && (dealerScore + value) > 21){
                value = 1;
            }
            dealerScore += value;

            if (dealerScore >= 17) {
                break;
            }

            card = this.drawCard(true);
            value = s_oGameSettings.getCardValue(card);
        }
    };

    // Using DOUBLE button as CLAIM button for now
    this.onDouble = function(){

    };

    // this.onDouble = function(){
    //     var iDoubleBet=_oSeat.getCurBet();
    //
    //     var iCurBet = iDoubleBet;
    //     iCurBet += iDoubleBet;
    //
    //     _oSeat.doubleAction(iCurBet);
    //     _oSeat.changeBet(iCurBet);
    //     _oSeat.decreaseCredit(iDoubleBet);
    //     _iGameCash += iDoubleBet;
    //     if (_iGameCash < (iCurBet * 2) ) {
    //         _bDealerLoseInCurHand = false;
    //     }
    //
    //     _oSeat.bet(iCurBet);
    //     _oInterface.refreshCredit(_oSeat.getCredit());
    //     this.onHit();
    //
    //     _bDoubleForPlayer=true;
    //     $(s_oMain).trigger("bet_placed",iDoubleBet);
    // };

    this.onSplit = function(){
        if (_iGameCash < (_oSeat.getCurBet() * 4) ) {
            _bDealerLoseInCurHand = false;
        }
        _oSeat.split();

        this.changeState(STATE_GAME_SPLIT);
    };

    this._onSplitCardEndAnim = function(){
        var iCurBet = _oSeat.getCurBet();
        var iSplitBet = iCurBet;
        iCurBet += iSplitBet;
        _oSeat.bet(iCurBet,true);

        _bSplitActive=true;

        _oInterface.enable(false,true,true,false,false);

        _oSeat.setSplitHand();
        _oSeat.refreshCardValue();

        _oSeat.changeBet(iCurBet-iSplitBet);
        _oSeat.decreaseCredit(iSplitBet);
        _iGameCash += iSplitBet;

        _oInterface.refreshCredit(_oSeat.getCredit());

        $(s_oMain).trigger("bet_placed",iSplitBet);
    };

    this.clearBets = function(){
        var iCurBet = _oSeat.getStartingBet();

        if (iCurBet>0){
            _oSeat.clearBet();
            _oSeat.increaseCredit(iCurBet);
            _iGameCash -= iCurBet;
            _oInterface.refreshCredit(_oSeat.getCredit());
            _oInterface.enable(false,false,false,false,false);
        }
    };

    this.rebet = function(){
        this.clearBets();

        if (_oSeat.rebet()){
            _oInterface.enable(true,false,false,false,false);
            _oInterface.refreshCredit(_oSeat.getCredit());
            _iTimeElaps = BET_TIME;
        } else {
            _oInterface.disableRebet();
        }

    };

    this.onBuyInsurance = function(){
        var iCurBet=_oSeat.getCurBet();
        iCurBet += _iInsuranceBet;
        _oSeat.insurance(iCurBet,-_iInsuranceBet,_iInsuranceBet);

        _oInterface.refreshCredit(_oSeat.getCredit());
    };

    this._onCardShown = function(){
        s_oGame._checkHand();
    };

    this._onRemoveCard = function(oCard){
        oCard.unload();
    };

    this.onExit = function(){
        this.unload();
	$(s_oMain).trigger("save_score",[_oSeat.getCredit()]);
        $(s_oMain).trigger("end_session");
        $(s_oMain).trigger("share_event",_oSeat.getCredit());
        s_oMain.gotoMenu();

    };

    this.getState = function(){
        return _iState;
    };

    this._updateWaitingBet = function(){
        _iTimeElaps += s_iTimeElaps;
        // if (_iTimeElaps>BET_TIME){
        //     _iTimeElaps=0;
        //
        //     if (_oSeat.getCurBet() <_iMinBet){
        //         return;
        //     }
        //     _oInterface.disableBetFiches();
        //     _oInterface.enable(true,false,false,false,false);
        //     this.changeState(STATE_GAME_DEALING);
        //
        //     $(s_oMain).trigger("bet_placed",_oSeat.getCurBet());
        // } else {
        //     var iCountDown=Math.floor((BET_TIME-_iTimeElaps)/1000);
        //    _oInterface.displayMsg(TEXT_MIN_BET+":"+_iMinBet+"\n"+TEXT_MAX_BET+":"+_iMaxBet,TEXT_DISPLAY_MSG_WAITING_BET+" "+iCountDown);
        // }
        _oInterface.displayMsg(TEXT_MIN_BET+":"+_iMinBet+"\n"+TEXT_MAX_BET+":"+_iMaxBet,TEXT_DISPLAY_MSG_WAITING_BET);
    };

    this._updateDealing = function(){
        for (var i=0;i<_aCardsDealing.length;i++){
            _aCardsDealing[i].update();
        }
    };

    this._updateHitting = function(){
        for (var i=0;i<_aCardsDealing.length;i++){
            _aCardsDealing[i].update();
        }
    };

    this._updateSplit = function(){
        _oSeat.updateSplit();
    };

    this._updateShowWinner = function(){
        _oSeat.updateFichesController(s_iTimeElaps);

        var aCards=_oSeat.getPlayerCards();
        for (var k=0;k<aCards.length;k++){
                aCards[k].update();
        }

        for (var j=0;j<_aDealerCards.length;j++){
                _aDealerCards[j].update();
        }

        _iTimeElaps+=s_iTimeElaps;
        if (_iTimeElaps>TIME_END_HAND){
            _iTimeElaps=0;
            this.reset(false);
            _oInterface.reset();

            if (_oSeat.getCredit()<s_oGameSettings.getFichesValueAt(0)){
                    this._gameOver();
                    this.changeState(-1);
            } else {
                    this.changeState(STATE_GAME_WAITING_FOR_BET);
            }

            _oInterface.refreshCredit(_oSeat.getCredit());
        }
    };

    this.update = function(){
        if (_bUpdate === false){
            return;
        }

        switch(_iState){
            case STATE_GAME_WAITING_FOR_BET:{
                    this._updateWaitingBet();
                    break;
            }
            case STATE_GAME_DEALING:{
                    this._updateDealing();
                    break;
            }
            case STATE_GAME_HITTING:{
                    this._updateHitting();
                    break;
            }
            case STATE_GAME_SPLIT:{
                    this._updateSplit();
                    break;
            }
            case STATE_GAME_SHOW_WINNER:{
                    this._updateShowWinner();
                    break;
            }
        }


    };

    s_oGame = this;

    TOTAL_MONEY      = oData.money;
    MIN_BET          = oData.min_bet;
    MAX_BET          = oData.max_bet;
    BET_TIME         = oData.bet_time;
    BLACKJACK_PAYOUT = oData.blackjack_payout;
    WIN_OCCURRENCE   = oData.win_occurrence;
    _iGameCash       = oData.game_cash;

    AD_SHOW_COUNTER  = oData.ad_show_counter;

    this._init();
}

var s_oGame;
var s_oTweenController;
