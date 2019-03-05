function CMenu(){
    var _pStartPosAudio;
    var _pStartPosFullscreen;
    var _pStartPosCredits;

    var _oBg;
    var _oButPlay;
    var _oButInstallMetaMask;
    var _oAudioToggle;
    var _oFade;
    var _oButFullscreen;
    var _oButCredits;
    var _oCreditsPanel = null;
    var _fRequestFullScreen = null;
    var _fCancelFullScreen = null;

    this._init = function(){
        _oBg = createBitmap(s_oSpriteLibrary.getSprite('bg_menu'));
        s_oStage.addChild(_oBg);


        if (window.ethereum) {
          var oSprite = s_oSpriteLibrary.getSprite('but_menu_bg');
          _oButPlay = new CTextButton((CANVAS_WIDTH/2),CANVAS_HEIGHT -164,oSprite,TEXT_PLAY,FONT_GAME_1,"#ffffff",40,s_oStage);
          _oButPlay.addEventListener(ON_MOUSE_UP, this._onButPlayRelease, this);
        } else {
          var oSprite = s_oSpriteLibrary.getSprite('but_game_small_bg');
          _oButInstallMetaMask = new CTextButton((CANVAS_WIDTH/2),CANVAS_HEIGHT -164,oSprite,TEXT_INSTALL_METAMASK,FONT_GAME_1,"#ffffff",14,s_oStage);
          _oButInstallMetaMask.addEventListener(ON_MOUSE_UP, this._oButInstallMetaMaskRelease, this);
        }

        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            var oSprite = s_oSpriteLibrary.getSprite('audio_icon');
            _pStartPosAudio = {x: CANVAS_WIDTH - (oSprite.width/4) - 10, y: (oSprite.height/2) + 10};
            _oAudioToggle = new CToggle(_pStartPosAudio.x,_pStartPosAudio.y,oSprite,s_bAudioActive,s_oStage);
            _oAudioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);
        }

        var oSpriteCredits = s_oSpriteLibrary.getSprite('but_credits');

        var doc = window.document;
        var docEl = doc.documentElement;
        _fRequestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        _fCancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

        if(ENABLE_FULLSCREEN === false){
            _fRequestFullScreen = false;
        }

        if (_fRequestFullScreen && inIframe() === false){
            oSprite = s_oSpriteLibrary.getSprite('but_fullscreen');
            _pStartPosFullscreen = {x:oSprite.width/4 + 10,y:oSprite.height/2 + 10};

            _oButFullscreen = new CToggle(_pStartPosFullscreen.x,_pStartPosFullscreen.y,oSprite,s_bFullscreen,s_oStage);
            _oButFullscreen.addEventListener(ON_MOUSE_UP, this._onFullscreenRelease, this);

            _pStartPosCredits = {x:_pStartPosFullscreen.x + 10 + oSprite.width/2,y:(oSprite.height / 2) + 10};
        }else{
            _pStartPosCredits = {x:10 + oSpriteCredits.width/2,y:(oSpriteCredits.height / 2) + 10};
        }

        if(SHOW_CREDITS){
            _oButCredits = new CGfxButton(_pStartPosCredits.x, _pStartPosCredits.y, oSpriteCredits);
            _oButCredits.addEventListener(ON_MOUSE_UP, this._onCredits, this);
        }

        _oFade = new createjs.Shape();
        _oFade.graphics.beginFill("black").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);

        s_oStage.addChild(_oFade);

        createjs.Tween.get(_oFade).to({alpha:0}, 400).call(function(){_oFade.visible = false;});

        this.refreshButtonPos (s_iOffsetX,s_iOffsetY);
    };

    this.refreshButtonPos = function(iNewX,iNewY){
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _oAudioToggle.setPosition(_pStartPosAudio.x - iNewX,iNewY + _pStartPosAudio.y);
        }
        if (_fRequestFullScreen && inIframe() === false){
            _oButFullscreen.setPosition(_pStartPosFullscreen.x + iNewX,_pStartPosFullscreen.y + iNewY);
        }

        if(SHOW_CREDITS){
            _oButCredits.setPosition(_pStartPosCredits.x + iNewX,_pStartPosCredits.y + iNewY);
        }

    };

    this.unload = function(){
        if (_oButPlay) {
          _oButPlay.unload();
          _oButPlay = null;
        }

        if (_oButInstallMetaMask) {
          _oButInstallMetaMask.unload();
          _oButInstallMetaMask = null;
        }

        if(SHOW_CREDITS){
            _oButCredits.unload();
        }


        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _oAudioToggle.unload();
            _oAudioToggle = null;
        }

        if (_fRequestFullScreen && inIframe() === false){
            _oButFullscreen.unload();
        }

        s_oStage.removeAllChildren();
        s_oMenu = null;
    };

    this._onButPlayRelease = function(){
        this.unload();
        s_oMain.gotoGame();

        $(s_oMain).trigger("start_session");
    };

    this._oButInstallMetaMaskRelease = function(){
      window.open("https://metamask.io","_blank");
    };

    this._onAudioToggle = function(){
        Howler.mute(s_bAudioActive);
        s_bAudioActive = !s_bAudioActive;
    };

    this._onFullscreenRelease = function(){
        if(s_bFullscreen) {
            _fCancelFullScreen.call(window.document);
            s_bFullscreen = false;
        }else{
            _fRequestFullScreen.call(window.document.documentElement);
            s_bFullscreen = true;
        }

        sizeHandler();
    };

    this._onCredits = function(){
        _oCreditsPanel = new CCreditsPanel();
    };

    s_oMenu = this;

    this._init();
}

var s_oMenu = null;