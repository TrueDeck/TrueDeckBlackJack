pragma solidity 0.4.23;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0) {
            return 0;
        }
        c = a * b;
        assert(c / a == b);
        return c;
    }

    /**
    * @dev Integer division of two numbers, truncating the quotient.
    */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        // uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return a / b;
    }

    /**
    * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    /**
    * @dev Adds two numbers, throws on overflow.
    */
    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a + b;
        assert(c >= a);
        return c;
    }
}

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public owner;

    event OwnershipRenounced(
        address indexed previousOwner
    );
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor() public {
        owner = msg.sender;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

/**
 * @title Destructible
 * @dev Base contract that can be destroyed by owner. All funds in contract will be sent to the owner.
 */
contract Destructible is Ownable {

    constructor() public payable { }

    /**
     * @dev Transfers the current balance to the owner and terminates the contract.
     */
    function destroy() onlyOwner public {
        selfdestruct(owner);
    }

    function destroyAndSend(address _recipient) onlyOwner public {
        selfdestruct(_recipient);
    }
}

contract TrueDeckBlackJack is Destructible {
    using SafeMath for uint256;

    event GameCreated(address player);
    event NewRound(address player, uint64 round, uint256 bet);
    event StageChanged(address player, uint64 round, Stage newStage);
    event BlockElected(address player, uint256 blockNumber, uint8 action);
    event Result(address player, uint64 round, uint8 playerScore, uint8 dealerScore, uint256 payout, uint256 credits);
    event Recharge(address player, uint256 credits);

    event Info1(address player, string code, string message, uint256 number);
    event Info2(address player, string code, string message, bytes32 number);
    event Error(address player, string code, string message, uint256 number);

    enum Stage {
        SitDown,
    	Bet,
    	Play,
        Stand
    }

    struct Game {
        uint64 round;
        uint256 startBlock;
        Stage stage;
        uint256 credits;

        uint256 bet;
        bytes32 seedhash;
        uint256 offset;
        uint256[] blocks;
        uint8[] actions;        // 1-Deal, 2-Hit, 3-Stand
    }

    struct Hand {
        uint8 score;
        uint8 length;
        uint8 numberOfAces;
    }

    uint8[13] private cardPoints = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];

    mapping(address => Game) private games;

    constructor() public {

    }

    function getRoundBlockNumber() public view returns (uint256 startBlock) {
        return games[msg.sender].startBlock;
    }

    function getCredits() public view returns (uint256) {
        return games[msg.sender].credits;
    }

    modifier atStage(Stage _stage) {
        require(
            games[msg.sender].stage == _stage,
            "Function cannot be called at this time."
        );
        _;
    }

    modifier notAtStage(Stage _stage) {
        require(
            games[msg.sender].stage != _stage,
            "Function cannot be called at this time."
        );
        _;
    }

    function nextStage(Game storage game) private {
        game.stage = Stage(uint8(game.stage) + 1);
        emit StageChanged(msg.sender, game.round, game.stage);
    }

    function initGame() public atStage(Stage.SitDown) {
        games[msg.sender] = Game({
                                round: 0,
                                startBlock: 1,
                                stage: Stage.SitDown,
                                credits: 1000,
                                bet: 0,
                                seedhash: "",
                                offset: 0,
                                blocks: new uint256[](0),
                                actions: new uint8[](0)
                            });

        emit GameCreated(msg.sender);
        nextStage(games[msg.sender]);
    }

    function newRound(bytes32 _seedhash, uint256 bet) public notAtStage(Stage.SitDown) {
        Game storage game = games[msg.sender];

        game.seedhash = _seedhash;
        game.bet = bet;
        game.credits = game.credits.sub(bet);

        game.round++;
        game.startBlock = block.number;
        game.stage = Stage.Bet;
        game.offset = game.blocks.length;

        emit NewRound(msg.sender, game.round, game.bet);
        nextStage(game);
        electBlock(game, 1);    // ACTION: DEAL
    }

    function hit() public atStage(Stage.Play) {
        electBlock(games[msg.sender], 2);    // ACTION: HIT
    }

    function stand() public atStage(Stage.Play) {
        Game storage game = games[msg.sender];
        nextStage(game);
        electBlock(game, 3);    // ACTION: STAND
    }

    function electBlock(Game storage game, uint8 action) private {
        game.blocks.push(block.number);
        game.actions.push(action);
        emit BlockElected(msg.sender, block.number, action);
    }

    function claim(string seed) public {
        Game storage game = games[msg.sender];

        // emit Info2(msg.sender, "SEEDHASH", "Expected", keccak256(seed));
        // emit Info2(msg.sender, "SEEDHASH", "Comitted", game.seedhash);

        if (game.seedhash == keccak256(seed)) {
            Hand memory playerHand = Hand(0, 0, 0);
            Hand memory dealerHand = Hand(0, 0, 0);

            // Replay game actions
            uint256 cardSeed = 0;

            for (uint256 i = game.offset; i < game.blocks.length; i++) {
                cardSeed = uint256(keccak256(abi.encodePacked(seed, blockhash(game.blocks[i]))));
                // emit Info1(msg.sender, "CARD", "", cardSeed);
                uint8 action = game.actions[i];

                if (action == 1) {
                    // DEAL
                    drawCard(playerHand, uint8((cardSeed & 255) % 52));
                    cardSeed = cardSeed >> 2;
                    drawCard(dealerHand, uint8((cardSeed & 255) % 52));
                    cardSeed = cardSeed >> 2;
                    drawCard(playerHand, uint8((cardSeed & 255) % 52));
                    cardSeed = cardSeed >> 2;
                } else if (action == 2) {
                    // HIT
                    drawCard(playerHand, uint8((cardSeed & 255) % 52));
                    cardSeed = cardSeed >> 2;
                } else if (action == 3) {
                    break;
                }
            }

            uint8 playerScore = getScore(playerHand);

            // If player has lost
            if (playerScore > 21) {
                // emit Info1(msg.sender, "RESULT", "Lost!", playerScore);
                return;
            }

            uint8 dealerScore = 0;
            // If player score is 21 or less / action is STAND
            // if (playerScore == 21 || action == 3) {     // No need to check, always true
                // Draw cards for dealer
                drawCard(dealerHand, uint8((cardSeed & 255) % 52));
                cardSeed = cardSeed >> 2;

                // Dealer must draw to 16 and stand on all 17's
                dealerScore = getScore(dealerHand);
                while (dealerScore < 17) {
                    drawCard(dealerHand, uint8((cardSeed & 255) % 52));
                    cardSeed = cardSeed >> 2;
                    dealerScore = getScore(dealerHand);
                }
            // }

            uint256 payout = 0;
            if ((playerScore == 21 && playerHand.length == 2) && !(dealerScore == 21 && dealerHand.length == 2)) {
                payout = game.bet * 3;
            } else if (playerScore > dealerScore || dealerScore > 21) {
                payout = game.bet * 2;
            } else if (playerScore == dealerScore) {
                payout = game.bet;
            }

            game.credits = game.credits.add(payout);

            emit Result(msg.sender, game.round, playerScore, dealerScore, payout, game.credits);
        } else {
            emit Error(msg.sender, "WRONG_SEED", "", 0);
        }
    }

    function recharge() public notAtStage(Stage.SitDown) {
        Game storage game = games[msg.sender];
        require(game.credits == 0);
        game.credits = 1000;
        emit Recharge(msg.sender, game.credits);
    }

    function drawCard(Hand hand, uint8 card) private view {
        hand.length++;
        uint8 value = cardPoints[card % 13];
        hand.score += value;
        if (value == 11) hand.numberOfAces++;
    }

    function getScore(Hand hand) private pure returns (uint8) {
        uint8 score = hand.score;
        uint8 numberOfAces = hand.numberOfAces;
        while (numberOfAces > 0 && score > 21) {
            score -= 10;
            numberOfAces--;
        }
        return score;
    }
}
