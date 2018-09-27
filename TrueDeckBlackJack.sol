pragma solidity ^0.4.23;

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
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract Pausable is Ownable {
    event Pause();
    event Unpause();

    bool public paused = false;

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        require(!paused);
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     */
    modifier whenPaused() {
        require(paused);
        _;
    }

    /**
     * @dev called by the owner to pause, triggers stopped state
     */
    function pause() onlyOwner whenNotPaused public {
        paused = true;
        emit Pause();
    }

    /**
     * @dev called by the owner to unpause, returns to normal state
     */
    function unpause() onlyOwner whenPaused public {
        paused = false;
        emit Unpause();
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

    /**
     * @notice Terminate contract and refund to _recipient
     * @param tokens List of addresses of ERC20 or ERC20Basic token contracts to refund.
     * @notice The called token contracts could try to re-enter this contract. Only supply token contracts you trust.
     */
    function destroy(address[] tokens) onlyOwner public {
        destroyAndSend(tokens, owner);
    }

    /**
     * @notice Terminate contract and refund to _recipient
     * @param tokens List of addresses of ERC20 or ERC20Basic token contracts to refund.
     * @notice The called token contracts could try to re-enter this contract. Only supply token contracts you trust.
     */
    function destroyAndSend(address[] tokens, address _recipient) onlyOwner public {
        // Transfer tokens to _recipient
        for (uint256 i = 0; i < tokens.length; i++) {
            ERC20Basic token = ERC20Basic(tokens[i]);
            uint256 balance = token.balanceOf(this);
            token.transfer(_recipient, balance);
        }

        // Transfer Eth to _recipient and terminate contract
        selfdestruct(_recipient);
    }
}

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
    function totalSupply() public view returns (uint256);
    function balanceOf(address who) public view returns (uint256);
    function transfer(address to, uint256 value) public returns (bool);
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );
}

contract TrueDeckBlackJack {
    using SafeMath for uint256;

    event StageChanged(uint256 gameId, uint64 round, Stage newStage);
    event NewRound(uint256 gameId, uint64 round, address player, uint256 bet);
    event CardDrawn(uint256 gameId, uint64 round, uint8 card, uint8 score, bool isDealer);
    event Result(uint256 gameId, uint64 round, uint256 payout, uint8 playerScore, uint8 dealerScore);

    enum Stage {
        SitDown,
    	Bet,
    	Play
    }

    struct Game {
        uint256 id;
        uint64 startTime;
        uint64 round;
        Stage stage;
        Player dealer;
        Player player;
    }

    struct Player {
        uint256 bet;
        uint256 seed;
        uint256[] hand;
        uint8 score;
    }

    uint256 constant NUMBER_OF_DECKS = 8;

    uint8[13] cardValues = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];

    mapping(address => Game) games;

    uint256 seed;

    constructor() public {
        seed = now;
    }

    function getGameState() public view returns (uint256 gameId, uint64 startTime, uint64 round, Stage stage) {
        Game storage game = games[msg.sender];
        gameId = game.id;
        startTime = game.startTime;
        round = game.round;
        stage = game.stage;
    }

    modifier atStage(Stage _stage) {
        require(
            games[msg.sender].stage == _stage,
            "Function cannot be called at this time."
        );
        _;
    }

    function nextStage(Game storage game) internal {
        game.stage = Stage(uint(game.stage) + 1);
        emit StageChanged(game.id, game.round, game.stage);
    }

    function reset(Game storage game) internal {
        game.stage = Stage.Bet;
        emit StageChanged(game.id, game.round, game.stage);
        game.player.bet = 0;
        game.player.score = 0;
        game.dealer.score = 0;
        delete game.player.hand;
        delete game.dealer.hand;
    }

    function initGame(uint256 _seed) public atStage(Stage.SitDown) {
        uint64 _now = uint64(now);
        uint256 id = uint256(keccak256(block.number, _now, _seed));                                                    // solium-disable-line

        seed += _seed;

        Player memory player;
        Player memory dealer;
        games[msg.sender] = Game(id, _now, 0, Stage.SitDown, dealer, player);

        nextStage(games[msg.sender]);
    }

    function newRound(uint256 _seed) public payable atStage(Stage.Bet) {
        Game storage game = games[msg.sender];

        seed += _seed;
        game.dealer.seed = _seed;
        game.player.seed = _seed;
        game.round++;

        emit NewRound(game.id, game.round, msg.sender, msg.value);

        nextStage(game);
        dealCards(game);
    }

    function addBet() payable public {
        Player memory player = games[msg.sender].player;
        player.bet = player.bet.add(msg.value);
    }

    function hit(uint256 _seed) public atStage(Stage.Play) {
        Game storage game = games[msg.sender];
        if (game.player.score > 21) {
            revert();
        }

        seed += _seed;

        drawCard(game, game.player);
        game.player.score = recalculate(game.player);

        if (game.player.score >= 21) {
            concludeGame(game);
        }
    }

    function stand(uint256 _seed) public atStage(Stage.Play) {
        Game storage game = games[msg.sender];
        seed += _seed;
        concludeGame(game);
    }

    function dealCards(Game storage game) private {
        drawCard(game, game.player);
        drawCard(game, game.dealer);
        drawCard(game, game.player);
    }

    /* TODO: Check for card repeatation */
    function drawCard(Game game, Player storage player) private returns (uint256) {
        uint64 _now = uint64(now);

        // Drawing card by generating a random index in a set of 8 deck
        uint256 card = ((player.seed * seed).add(_now)) % (NUMBER_OF_DECKS*52);

        // Modify seeds
        player.seed = uint256(keccak256(player.seed, card, _now));
        seed = uint256(keccak256(seed, card, _now));

        // Push the card index to player hand
        player.hand.push(card);

        // Recalculate player score
        card = card % 52 % 13;
        if (card == 0) {
            player.score = recalculate(player);
        } else if (card > 10) {
            player.score += cardValues[card];
        }

        emit CardDrawn(game.id, game.round, uint8(card % 52), player.score, player.bet == 0);

        return card;
    }

    function recalculate(Player player) private view returns (uint8 score) {
		uint8 numberOfAces = 0;
        for (uint8 i = 0; i < player.hand.length; i++) {
            uint8 card = (uint8) (player.hand[i] % 52 % 13);
			score += cardValues[card];
            if (card == 0) numberOfAces++;
        }
        while (numberOfAces > 0 && score > 21) {
            score -= 10;
            numberOfAces--;
        }
    }

    function concludeGame(Game storage game) private {
        uint256 payout = calculatePayout(game);
        if (payout != 0) {
            msg.sender.transfer(payout);
        }
        emit Result(game.id, game.round, payout, game.player.score, game.dealer.score);

        reset(game);
    }

    function calculatePayout(Game storage game) private returns (uint256 payout) {
        Player memory player = game.player;
        Player memory dealer = game.dealer;
        // Player busted
        if (player.score > 21) {
            payout = 0;
        } else {
            bool dealerHasBJ = drawDealerCards(game);

            // Player has BlackJack but dealer does not.
            if (player.score == 21 && player.hand.length == 2 && !dealerHasBJ) {
                // Pays 2 to 1
                payout = player.bet * 3;
            } else if (player.score > dealer.score || dealer.score > 21) {
                payout = player.bet * 2;
            } else if (player.score == dealer.score) {
                payout = player.bet;
            } else {
                payout = 0;
            }
        }
    }

    function drawDealerCards(Game storage game) private returns (bool) {
        // Draw dealer's next card to check for BlackJack
        drawCard(game, game.dealer);
        if (game.dealer.score == 21) {
            return true;
        }

        // Dealer must draw to 16 and stand on all 17's
        while (game.dealer.score < 17) {
            drawCard(game, game.dealer);
        }

        return false;
    }
}
