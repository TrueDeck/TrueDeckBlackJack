function CGoChainRPC(){
    var _oTextTitle;
    var _rpcHeaderText;
    var _rpcInstText;
    var _rpcUrl;
    var _oContainer;

    this._init = function(){
        _oContainer = new createjs.Container();
        s_oStage.addChild(_oContainer);
		    _oContainer.on("click",function(){});

        var oBg = createBitmap(s_oSpriteLibrary.getSprite('msg_box'));
        _oContainer.addChild(oBg);

        _oTextTitle = new createjs.Text("Switch to GoChain Mainnet","bold 24px "+FONT_GAME_1, "#fff");
        _oTextTitle.textAlign = "left";
        _oTextTitle.x = CANVAS_WIDTH/2-220;
        _oTextTitle.y = 290;
        _oTextTitle.lineWidth = 450;
        _oContainer.addChild(_oTextTitle);

        _rpcHeaderText = new createjs.Text('Add "Custom RPC" in MetaMask',"bold 20px "+FONT_GAME_1, "#ddd");
        _rpcHeaderText.textAlign = "left";
        _rpcHeaderText.x = CANVAS_WIDTH/2-220;
        _rpcHeaderText.y = 330;
        _rpcHeaderText.lineWidth = 450;
        _oContainer.addChild(_rpcHeaderText);

        _rpcInstText = new createjs.Text('Put following in "New RPC URL" and save',"bold 18px "+FONT_GAME_1, "#ddd");
        _rpcInstText.textAlign = "left";
        _rpcInstText.x = CANVAS_WIDTH/2-220;
        _rpcInstText.y = 360;
        _rpcInstText.lineWidth = 450;
        _oContainer.addChild(_rpcInstText);

        _rpcUrl = new createjs.Text('https://rpc.gochain.io',"bold 22px "+FONT_GAME_1, "#fff");
        _rpcUrl.textAlign = "left";
        _rpcUrl.x = CANVAS_WIDTH/2-220;
        _rpcUrl.y = 390;
        _rpcUrl.lineWidth = 450;
        _oContainer.addChild(_rpcUrl);

        this.hide();
    };

  	this.unload = function(){
  		_oContainer.off("click",function(){});
  	};

    this.show = function(){
        _oContainer.visible = true;
    };

    this.hide = function(){
        _oContainer.visible = false;
    };

    this._init();
}
