angular.module('sg.youtube', []).constant('youtubeBasePath', 'http://www.youtube.com').run(function() {

  /*
  			Add the YoutubeIframe API script to the dom
   */
  var firstScriptTag, tag;
  tag = document.createElement('script');
  tag.src = "http://www.youtube.com/iframe_api";
  firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  return this;
}).config([
  '$sceDelegateProvider', 'youtubeBasePath', function($sceDelegateProvider, youtubeBasePath) {

    /*
    				Extend resourceUrlWhitelist
    				TODO:
    					- Maybe the developer should be adding it manually to its app?
    					- Look for a nicer way to do it
    					(in this scenario, previously added urls are re-processed by Angular)
     */
    var newRUWL;
    newRUWL = $sceDelegateProvider.resourceUrlWhitelist();
    newRUWL.push("" + youtubeBasePath + "/**");
    $sceDelegateProvider.resourceUrlWhitelist(newRUWL);
    return this;
  }
]).service('YTI.TimeHelper', [
  function() {

    /*
    				@service YTI.TimeHelper
    
    				A simple service to display a nice time string (hh:mm:ss) to the end user
    				because the Youtube API deals with seconds.
     */
    var _twoNumbers;
    _twoNumbers = function(number) {
      if (number < 10) {
        return "0" + number;
      } else {
        return number;
      }
    };
    this.secondsToTimeString = function(timeInSeconds) {
      var hours, minutes, seconds, timeString;
      if (timeInSeconds > 0) {
        hours = parseInt(timeInSeconds / 3600) % 24;
        minutes = parseInt(timeInSeconds / 60) % 60;
        seconds = timeInSeconds % 60;
        timeString = "";
        if (hours > 0) {
          timeString += _twoNumbers(hours) + ":";
        }
        timeString += _twoNumbers(minutes) + ":";
        timeString += _twoNumbers(seconds);
      } else {
        timeString = "00:00";
      }
      return timeString;
    };
    return this;
  }
]).constant('YTI.PlayerEvents', (function() {

  /*
  			@constant YTI.PlayerEvents
  			
  			Custom player events
  			This is useful if you want to listen for broadcasted events
  			from outside the 'youtubeIframe' if you ever needed.
  			Otherwise You shouldn't use it, but instead '$watch' for
  			value changes on the controller scope.
   */
  return {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    REWIND: 'rewind',
    READY: 'ready'
  };
})()).service('YTI.Api', [
  '$window', '$log', '$q', function($window, $log, $q) {

    /*
    				@service YTI.Api
    
    				Abstract the Youtube Iframe native API
    				- Waits for API to be ready
    				- Provides a safe player creation method
     */
    var _createPlayer, _isReady, _waitingPlayers;
    _waitingPlayers = [];
    _isReady = false;
    $window.onYouTubeIframeAPIReady = function() {
      _isReady = true;
      if (_waitingPlayers.length > 0) {
        return angular.forEach(_waitingPlayers, function(val) {
          return val[0].resolve(_createPlayer(val[1], val[2]));
        });
      }
    };
    _createPlayer = function(id, ytObj) {
      return new YT.Player(id, ytObj);
    };
    this.createPlayer = function(id, ytObj) {
      var d;
      d = $q.defer();
      if (!id || id === '') {
        d.reject('You need to specified an html element id to create the player');
      } else if (!ytObj.videoId || ytObj.videoId === '') {
        d.reject('A youtube videoId is required to create a player');
      } else if (_isReady) {
        d.resolve(_createPlayer(id, ytObj));
      } else {
        _waitingPlayers.push([d, id, ytObj]);
      }
      return d.promise;
    };
    return this;
  }
]).controller('YTI.PlayerController', [
  '$scope', '$log', '$timeout', 'YTI.PlayerEvents', function($scope, $log, $timeout, playerEvents) {

    /*
    				@controller YTI.PlayerController
    
    				Abstract the YoutubeIframe native properties and methods
    				/!\ Only this controller should be using the YoutubeIframe API native properties or methods!
     */
    var cLogInfo, progressTimer, resetPlayer, resetProgressTimer, startListeningForProgress, stopListeningForProgress;
    progressTimer = null;
    angular.extend($scope, {
      currentTime: 0,
      currentProgress: 0,
      currentSecond: 0,
      isPlaying: false,
      isMuted: false,
      isFullscreen: false,
      hasEverPlayed: false,
      isPlayerReady: false
    });
    cLogInfo = function(act, msg) {};
    resetProgressTimer = function() {
      if (progressTimer) {
        $timeout.cancel(progressTimer);
        return progressTimer = null;
      }
    };
    stopListeningForProgress = function() {
      return resetProgressTimer();
    };
    startListeningForProgress = function() {
      var progressFn;
      resetProgressTimer();
      progressFn = function() {
        var currentProgress, currentSecond, currentTime, duration;
        currentTime = $scope.ytPlayer.getCurrentTime();
        currentSecond = currentTime >> 0;
        duration = $scope.ytPlayer.getDuration();
        currentProgress = (currentTime / duration * 10000 >> 0) / 100;
        progressTimer = $timeout(progressFn, 10);
        return angular.extend($scope, {
          currentTime: currentTime,
          currentProgress: currentProgress,
          currentSecond: currentSecond
        });
      };
      return progressFn();
    };
    resetPlayer = function() {
      return angular.extend($scope, {
        currentTime: 0,
        currentProgress: 0,
        currentSecond: 0
      });
    };
    $scope.cueVideoById = function(videoId) {
      cLogInfo("yt cueVideoById, videoId: " + videoId);
      return $scope.ytPlayer.cueVideoById(videoId);
    };
    $scope.play = function() {
      cLogInfo('yt play');
      return $scope.ytPlayer.playVideo();
    };
    $scope.pause = function() {
      cLogInfo('yt pause');
      return $scope.ytPlayer.pauseVideo();
    };
    $scope.mute = function() {
      cLogInfo('yt mute');
      return $scope.ytPlayer.mute();
    };
    $scope.unMute = function() {
      cLogInfo('yt unMute');
      return $scope.ytPlayer.unMute();
    };
    $scope.seekTo = function(seconds, allowSeekAhead) {
      cLogInfo("yt seekTo, seconds: " + seconds + ", allowSeekAhead: " + allowSeekAhead);
      if (seconds < $scope.currentTime) {
        $scope.$emit("" + playerEvents.REWIND);
      }
      return $scope.ytPlayer.seekTo(seconds, allowSeekAhead || true);
    };
    $scope.togglePlay = function() {
      cLogInfo('yt togglePlay');
      if ($scope.isPlayerReady) {
        if ($scope.isPlaying) {
          return $scope.pause();
        } else {
          return $scope.play();
        }
      }
    };
    $scope.toggleSound = function() {
      cLogInfo('yt toggleSound');
      if ($scope.isPlayerReady) {
        if ($scope.ytPlayer.isMuted()) {
          $scope.isMuted = false;
          return $scope.unMute();
        } else {
          $scope.isMuted = true;
          return $scope.mute();
        }
      }
    };
    $scope.toggleFullscreen = function() {
      cLogInfo('yt toggleFullscreen');
      if ($scope.isFullscreen) {
        return $scope.isFullscreen = false;
      } else {
        return $scope.isFullscreen = true;
      }
    };
    $scope.getDuration = function() {
      if ($scope.isPlayerReady) {
        return $scope.ytPlayer.getDuration();
      } else {
        return 0;
      }
    };
    $scope.stop = function() {
      cLogInfo('yt stop');
      $scope.seekTo(0);
      return $scope.pause();
    };
    $scope.onReady = function(e) {
      cLogInfo('yt onReady', e);
      $scope.isPlayerReady = true;
      return $scope.$broadcast("" + playerEvents.READY, $scope.ytPlayer);
    };
    $scope.onStateChange = function(e) {
      var playerState;
      cLogInfo('onStateChange', e);
      playerState = e.data;
      if (playerState === YT.PlayerState.PLAYING) {
        startListeningForProgress();
        return $scope.$apply(function() {
          if (!$scope.hasEverPlayed) {
            $scope.hasEverPlayed = true;
          }
          $scope.isPlaying = true;
          return $scope.$emit("" + playerEvents.PLAYING, {});
        });
      } else if (playerState === YT.PlayerState.PAUSED) {
        stopListeningForProgress();
        return $scope.$apply(function() {
          $scope.isPlaying = false;
          return $scope.$emit("" + playerEvents.PAUSED, {
            currentTime: $scope.currentTime,
            currentProgress: $scope.currentProgress,
            currentSecond: $scope.currentSecond,
            duration: $scope.getDuration()
          });
        });
      } else if (playerState === YT.PlayerState.ENDED) {
        stopListeningForProgress();
        return $scope.$apply(function() {
          resetPlayer();
          return $scope.$emit("" + playerEvents.ENDED, {});
        });
      } else if (playerState === YT.PlayerState.BUFFERING) {
        stopListeningForProgress();
        return $scope.$emit("" + playerEvents.BUFFERING, {});
      }
    };
    $scope.$on('YTI.ExtEvents.CallFn', function(e, data) {
      if (angular.isString(data) && angular.isFunction($scope[data])) {
        return $scope[data]();
      }
    });
    return $scope;
  }
]).directive('youtubeIframe', [
  '$log', 'YTI.Api', '$timeout', '$window', function($log, ytiApi, $timeout, $window) {

    /*
    				@directive youtubeIframe
    
    				@desc
    					Youtube Iframe directive
    
    				@attributes
    					[required]
    					- @videoId {variable|String} : id of the video
    					[optional]
    					- @width {String} [default: 480]: width of the player in pixels.
    					You can also use percentages (example: "100%"), in this case,
    					the height will be ignored and calculated based on the "ratio"
    					each time the window is resized
    					- @height {Sring} [default: 270] height of the player in pixels
    					- @ratio {String} [default: 0.5625]: ratio of the player (default to 9/16)
    					- @safeautoplay {Boolean} [default: false]: if the player should autoplay
    					/!\ it will work only for devices supporting this functionnality
    					- @chromeless {Boolean} [default: false]: if the player should be chromeless.
    					(no controls, info or related videos at the end)
    					/!\ A minimal Youtube branding is still showing on the bottom right corner
    					when the player is paused. It's something you can't remove and shouldn't hide!
    
    				@example
    					- Minimum required:
    						<div youtube-iframe videoId="YOUR_VIDEO_ID"></div>
    
    					- All options (with defaults):
    						<div youtube-iframe videoId="YOUR_VIDEO_ID" width="480" height="270" safeautoplay="false" chromeless="false" ratio="0.5625"></div>
     */
    return {
      restrict: 'AE',
      controller: 'YTI.PlayerController',
      scope: {
        height: '@',
        width: '@',
        safeautoplay: '@',
        chromeless: '@'
      },
      transclude: true,
      template: '<div id="{{playerId}}" yti-player></div><div yti-overlay ng-transclude ng-class="{\'touch-enabled\':hasEverPlayed}"></div>',
      link: function(scope, element, attrs, ctrl) {
        var _calcPlayerSize, _clearTimer, _createPlayer, _hideControls, _mouseMoveTimer, _playerCreated, _queueNewVideo, _showControls;
        angular.extend(scope, {
          playerId: "" + attrs.id + "-ytplayer",
          ytPlayer: null,
          relativeHeight: null
        });
        _playerCreated = false;
        _mouseMoveTimer = null;
        if (!scope.ratio) {
          scope.ratio = 9 / 16;
        }
        _calcPlayerSize = function() {
          return scope.relativeHeight = Math.round(element.width() * scope.ratio);
        };
        _clearTimer = function() {
          if (_mouseMoveTimer) {
            $timeout.cancel(_mouseMoveTimer);
            return _mouseMoveTimer = null;
          }
        };
        _showControls = function() {
          return element.removeClass('hide-controls');
        };
        _hideControls = function() {
          return element.addClass('hide-controls');
        };
        _createPlayer = function() {
          return ytiApi.createPlayer(scope.playerId, {
            height: scope.height ? scope.height : 270,
            width: scope.width ? scope.width : 480,
            videoId: scope.videoId,
            playerVars: {
              modestbranding: scope.chromeless ? 1 : 0,
              controls: scope.chromeless ? 0 : 1,
              showinfo: scope.chromeless ? 0 : 1,
              autoplay: scope.safeautoplay ? 1 : 0,
              rel: scope.chromeless ? 0 : 1,
              version: 3,
              wmode: "transparent"
            },
            events: {
              onReady: ctrl.onReady,
              onStateChange: ctrl.onStateChange
            }
          }).then(function(ytPlayer) {
            scope.ytPlayer = ytPlayer;
            return _playerCreated = true;
          }, function(err) {
            return $log.error(err);
          });
        };
        _queueNewVideo = function() {
          return ctrl.cueVideoById(scope.videoId);
        };
        if (scope.width && scope.width.slice(-1) === "%") {
          scope.$watch('relativeHeight', function(newHeight) {
            return element.css('height', newHeight);
          });
          angular.element($window).on('resize', function(e) {
            return _calcPlayerSize();
          });
          _calcPlayerSize();
        }
        if (attrs.videoId) {
          if (scope.$parent[attrs.videoId]) {
            scope.$watch(function() {
              return scope.$parent[attrs.videoId];
            }, function(newVideoId) {
              if (newVideoId) {
                scope.videoId = newVideoId;
                if (!_playerCreated) {
                  return _createPlayer();
                } else {
                  return _queueNewVideo();
                }
              }
            });
          } else if (angular.isString(attrs.videoId)) {
            scope.videoId = attrs.videoId;
            _createPlayer();
          }
        }
        ctrl.$watch(function() {
          return ctrl.isMuted;
        }, function(isMuted) {
          if (isMuted) {
            return element.addClass('is-muted');
          } else {
            return element.removeClass('is-muted');
          }
        });
        ctrl.$watch(function() {
          return ctrl.isFullscreen;
        }, function(isFullscreen) {
          var video;
          video = element[0];
          if (!video) {
            return false;
          }
          if (isFullscreen) {
            element.addClass('is-fullscreen');
            if (video.requestFullscreen) {
              return video.requestFullscreen();
            } else if (video.msRequestFullscreen) {
              return video.msRequestFullscreen();
            } else if (video.mozRequestFullScreen) {
              return video.mozRequestFullScreen();
            } else if (video.webkitRequestFullscreen) {
              return video.webkitRequestFullscreen();
            }
          } else {
            element.removeClass('is-fullscreen');
            if (document.exitFullscreen) {
              return document.exitFullscreen();
            } else if (document.msExitFullscreen) {
              return document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
              return document.mozCancelFullScreen();
            } else if (document.webkitCancelFullScreen) {
              return document.webkitCancelFullScreen();
            }
          }
        });
        ctrl.$watch(function() {
          return ctrl.isPlaying;
        }, function(isPlaying) {
          _clearTimer();
          if (isPlaying) {
            element.addClass('is-playing');
            return element.triggerHandler('mousemove');
          } else {
            element.removeClass('is-playing');
            return _showControls();
          }
        });
        element.on('mouseleave', function() {
          if (ctrl.isPlaying) {
            _clearTimer();
            return _hideControls();
          }
        });
        element.on('mousemove', function() {
          if (ctrl.isPlaying) {
            _showControls();
            _clearTimer();
            return _mouseMoveTimer = $timeout(function() {
              return _hideControls();
            }, 2000);
          }
        });
        return this;
      }
    };
  }
]).directive('ytiPlayPause', [
  function() {

    /*
    				@directive ytiPlayPause
    
    				@desc
    					Play/Pause toggler
    					/!\ Should be a child of "youtubeIframe" directive
    
    				@example
    					<any yti-play-pause></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      link: function(scope, element, attrs, iframeCtrl) {
        element.on('click', function(e) {
          e.preventDefault();
          iframeCtrl.togglePlay();
          return scope.$apply();
        });
        return this;
      }
    };
  }
]).directive('ytiSound', [
  function() {

    /*
    				@directive ytiSound
    
    				@desc
    					Sound toggler
    					/!\ Should be a child of "youtubeIframe" directive
    
    					TODO:
    						- add sound volume control
    
    				@example
    					<any yti-sound></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      link: function(scope, element, attrs, iframeCtrl) {
        element.on('click', function(e) {
          e.preventDefault();
          iframeCtrl.toggleSound();
          return scope.$apply();
        });
        return this;
      }
    };
  }
]).directive('ytiFullscreen', [
  function() {

    /*
    				@directive ytiFullscreen
    
    				@desc
    					Fullscreen toggler
    					/!\ Should be a child of "youtubeIframe" directive
    
    				@example
    					<any yti-fullscreen></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      link: function(scope, element, attrs, iframeCtrl) {
        element.on('click', function(e) {
          e.preventDefault();
          iframeCtrl.toggleFullscreen();
          return scope.$apply();
        });
        return this;
      }
    };
  }
]).directive('ytiCurrentTime', [
  'YTI.TimeHelper', function(timeHelper) {

    /*
    				@directive ytiCurrentTime
    
    				@desc
    					Display the current time of the video
    					/!\ Should be a child of "youtubeIframe" directive
    
    				@example
    					<any yti-current-time></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      scope: true,
      replace: true,
      template: '<div>{{time}}</div>',
      link: function(scope, element, attrs, iframeCtrl) {
        scope.time = timeHelper.secondsToTimeString(0);
        iframeCtrl.$watch(function() {
          return iframeCtrl.currentSecond;
        }, function(currentSecond) {
          if (currentSecond) {
            return scope.time = timeHelper.secondsToTimeString(currentSecond);
          } else {
            return scope.time = timeHelper.secondsToTimeString(0);
          }
        });
        return this;
      }
    };
  }
]).directive('ytiDuration', [
  'YTI.TimeHelper', function(timeHelper) {

    /*
    				@directive ytiDuration
    
    				@desc
    					Display the total duration the video
    					/!\ Should be a child of "youtubeIframe" directive
    
    				@example
    					<any yti-duration></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      scope: true,
      replace: true,
      template: '<div>{{duration}}</div>',
      link: function(scope, element, attrs, iframeCtrl) {
        scope.duration = timeHelper.secondsToTimeString(0);
        scope.$watch(function() {
          return iframeCtrl.isPlayerReady;
        }, function(newValue) {
          if (newValue) {
            return scope.duration = timeHelper.secondsToTimeString(iframeCtrl.getDuration());
          }
        });
        return this;
      }
    };
  }
]).directive('ytiPosterFrame', [
  'YTI.PlayerEvents', function(playerEvents) {

    /*
    				@directive ytiPosterFrame
    
    				@desc
    					Display the video poster frame,
    					only when the video has never been played or if ended.
    					/!\ Should be a child of "youtubeIframe" directive
    
    				@attributes
    					[required]
    					- @img {String}: the url of the poster frame
    
    				@example
    					<any yti-poster-frame></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      scope: {
        img: '@'
      },
      replace: true,
      template: '<div style="background-image:url({{img}});" ng-class="{visible:shouldBeVisible}"></div>',
      link: function(scope, element, attrs, iframeCtrl) {
        angular.extend(scope, {
          shouldBeVisible: true
        });
        scope.$watch(function() {
          return iframeCtrl.isPlaying;
        }, function(newValue) {
          if (newValue) {
            return scope.shouldBeVisible = false;
          }
        });
        iframeCtrl.$on("" + playerEvents.ENDED, function(e) {
          return scope.shouldBeVisible = true;
        });
        return this;
      }
    };
  }
]).directive('ytiProgressBar', [
  function() {

    /*
    				@directive ytiProgressBar
    
    				@desc
    					The video progress bar
    					/!\ Should be a child of "youtubeIframe" directive
    
    					TODO:
    						- add timeline feedback for mouse interactions
    
    				@example
    					<any yti-progress-bar></any>
     */
    return {
      restrict: 'A',
      require: '^youtubeIframe',
      scope: true,
      replace: true,
      template: '<div class="yti-progress-bar-container"> <div class="yti-progress-bar" style="width:{{percent}}%"></div> <div class="yti-progress-tilt" style="left:{{percent}}%"></div> </div>',
      link: function(scope, element, attrs, iframeCtrl) {
        angular.extend(scope, {
          percent: 0
        });
        element.on('click', function(e) {
          var percentPos;
          e.preventDefault();
          percentPos = e.offsetX / element.width();
          iframeCtrl.seekTo(iframeCtrl.getDuration() * percentPos);
          iframeCtrl.play();
          scope.$apply();
        });
        iframeCtrl.$watch(function() {
          return iframeCtrl.currentProgress;
        }, function(currentProgress, oldCurrentProgress) {
          return scope.percent = currentProgress;
        });
        return this;
      }
    };
  }
]);
