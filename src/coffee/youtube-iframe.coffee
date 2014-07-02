angular
	.module('sg.youtube', [])

	.constant('youtubeBasePath', 'http://www.youtube.com')

	.run(()->

		###
			Add the YoutubeIframe API script to the dom
		###

		tag = document.createElement 'script'
		tag.src = "http://www.youtube.com/iframe_api"
		firstScriptTag = document.getElementsByTagName('script')[0]
		firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
		
		return @
	)

	.config([
		'$sceDelegateProvider'
		'youtubeBasePath'
		($sceDelegateProvider, youtubeBasePath)->

			###
				Extend resourceUrlWhitelist
				TODO:
					- Maybe the developer should be adding it manually to its app?
					- Look for a nicer way to do it
					(in this scenario, previously added urls are re-processed by Angular)
			###

			newRUWL = $sceDelegateProvider.resourceUrlWhitelist()
			newRUWL.push "#{youtubeBasePath}/**"
			$sceDelegateProvider.resourceUrlWhitelist newRUWL

			return @
	])

	.service('YTI.TimeHelper', [
		()->
			###
				@service YTI.TimeHelper

				A simple service to display a nice time string (hh:mm:ss) to the end user
				because the Youtube API deals with seconds.
			###

			_twoNumbers = (number)->
				return if number < 10 then "0"+number else number
			
			@secondsToTimeString = (timeInSeconds)->
				if timeInSeconds>0
					hours = parseInt( timeInSeconds / 3600 ) % 24
					minutes = parseInt( timeInSeconds / 60 ) % 60
					seconds = timeInSeconds % 60

					timeString = ""
					if hours > 0
						timeString += _twoNumbers(hours) + ":"
					timeString += _twoNumbers(minutes) + ":"
					timeString += _twoNumbers(seconds)
				else
					timeString = "00:00"

				return timeString

			return @
	])

	.constant('YTI.PlayerEvents', (()->

		###
			@constant YTI.PlayerEvents
			
			Custom player events
			This is useful if you want to listen for broadcasted events
			from outside the 'youtubeIframe' if you ever needed.
			Otherwise You shouldn't use it, but instead '$watch' for
			value changes on the controller scope.
		###

		return {
			ENDED: 0 # = YT.PlayerState.ENDED
			PLAYING: 1 # = YT.PlayerState.PLAYING
			PAUSED: 2 # = YT.PlayerState.PAUSED
			BUFFERING: 3 # = YT.PlayerState.BUFFERING
			REWIND: 'rewind'
			READY: 'ready'
		}
	)())

	.service('YTI.Api', [
		'$window'
		'$log'
		'$q'
		($window, $log, $q)->

			###
				@service YTI.Api

				Abstract the Youtube Iframe native API
				- Waits for API to be ready
				- Provides a safe player creation method
			###

			_waitingPlayers = [] # store player creation attempts prior the API is ready
			_isReady = false

			# Default callback function called by the YoutubePlayerApi
			# as soon as the API is ready
			$window.onYouTubeIframeAPIReady = ()->
            	# $log.info 'onYouTubeIframeAPIReady'
            	_isReady = true
            	# create all players waiting for the API (if any)
            	if _waitingPlayers.length>0
            		angular.forEach _waitingPlayers, (val)->
            			val[0].resolve _createPlayer(val[1],val[2]) # resolve player creation promise

            _createPlayer = (id, ytObj)->
            	return new YT.Player(id, ytObj)

            # Safe YoutubePlayer creation method using promise
            # - Checks for playerID
            # - Checks for videoId
            # - Waits for the API to be ready
            @createPlayer = (id, ytObj)->
            	d = $q.defer()
            	if !id or id==''
            		d.reject('You need to specified an html element id to create the player')
            	else if !ytObj.videoId or ytObj.videoId==''
            		d.reject('A youtube videoId is required to create a player')
            	else if _isReady
            		d.resolve( _createPlayer(id, ytObj) )
            	else
            		_waitingPlayers.push [d, id, ytObj]
            	
            	return d.promise

			return @ 
	])

	.controller('YTI.PlayerController', [
		'$scope'
		'$log'
		'$timeout'
		'YTI.PlayerEvents'
		($scope, $log, $timeout, playerEvents)->

			###
				@controller YTI.PlayerController

				Abstract the YoutubeIframe native properties and methods
				/!\ Only this controller should be using the YoutubeIframe API native properties or methods!
			###

			# -------------------
			# Private vars
			# -------------------
			progressTimer = null

			# -------------------
			# Public vars
			# -------------------
			angular.extend $scope, {
				currentTime: 0
				currentProgress: 0
				currentSecond: 0
				isPlaying: false
				isMuted: false
				isFullscreen: false
				hasEverPlayed: false
				isPlayerReady: false
			}

			# -------------------
			# Private functions
			# -------------------

			# Custom $log.info in order to clearly identify the good player
			cLogInfo = (act,msg)->
				# $log.info "[#{$scope.playerId} (YT Player) - #{act}]", msg or ''

			resetProgressTimer = ()->
				if progressTimer
					$timeout.cancel progressTimer # angular clearInterval
					progressTimer = null

			stopListeningForProgress = ()->
				resetProgressTimer()

			startListeningForProgress = ()->
				resetProgressTimer()
				progressFn = ()->
					currentTime = $scope.ytPlayer.getCurrentTime()
					currentSecond = currentTime>>0
					duration = $scope.ytPlayer.getDuration()
					currentProgress = (currentTime/duration*10000>>0) /100
					progressTimer = $timeout progressFn, 10

					angular.extend $scope, {
						currentTime: currentTime
						currentProgress: currentProgress
						currentSecond: currentSecond
					}

				progressFn()

			resetPlayer = ()->
				angular.extend $scope, {
					currentTime: 0
					currentProgress: 0
					currentSecond: 0
				}

			# -------------------
			# Public functions
			# -------------------
			$scope.cueVideoById = (videoId)->
				cLogInfo "yt cueVideoById, videoId: #{videoId}"
				$scope.ytPlayer.cueVideoById(videoId)

			$scope.play = ()->
				cLogInfo 'yt play'
				$scope.ytPlayer.playVideo()

			$scope.pause = ()->
				cLogInfo 'yt pause'
				$scope.ytPlayer.pauseVideo()

			$scope.mute = ()->
				cLogInfo 'yt mute'
				$scope.ytPlayer.mute()

			$scope.unMute = ()->
				cLogInfo 'yt unMute'
				$scope.ytPlayer.unMute() 

			$scope.seekTo = (seconds, allowSeekAhead)->
				cLogInfo "yt seekTo, seconds: #{seconds}, allowSeekAhead: #{allowSeekAhead}"
				$scope.$emit("#{playerEvents.REWIND}") if seconds<$scope.currentTime
				$scope.ytPlayer.seekTo(seconds, allowSeekAhead or true)

			$scope.togglePlay = ()->
				cLogInfo 'yt togglePlay'
				if $scope.isPlayerReady
					if $scope.isPlaying then $scope.pause() else $scope.play()

			$scope.toggleSound = ()->
				cLogInfo 'yt toggleSound'
				if $scope.isPlayerReady
					if $scope.ytPlayer.isMuted()
						$scope.isMuted = false
						$scope.unMute()
					else
						$scope.isMuted = true
						$scope.mute()

			$scope.toggleFullscreen = ()->
				cLogInfo 'yt toggleFullscreen'
				if $scope.isFullscreen
					$scope.isFullscreen = false
				else
					$scope.isFullscreen = true

			$scope.getDuration = ()->
				return if $scope.isPlayerReady then $scope.ytPlayer.getDuration() else 0

			$scope.stop = ()->
				cLogInfo 'yt stop'
				$scope.seekTo(0)
				$scope.pause()

			$scope.onReady = (e)->
				cLogInfo 'yt onReady', e
				$scope.isPlayerReady = true
				$scope.$broadcast "#{playerEvents.READY}", $scope.ytPlayer 

			$scope.onStateChange = (e)->
				cLogInfo 'onStateChange', e
				playerState = e.data
				if playerState == YT.PlayerState.PLAYING
					startListeningForProgress()
					$scope.$apply ()->
						$scope.hasEverPlayed = true if !$scope.hasEverPlayed
						$scope.isPlaying = true
						$scope.$emit "#{playerEvents.PLAYING}", {}

				else if playerState == YT.PlayerState.PAUSED
					stopListeningForProgress()
					$scope.$apply ()->
						$scope.isPlaying = false
						$scope.$emit "#{playerEvents.PAUSED}", {
							currentTime: $scope.currentTime
							currentProgress: $scope.currentProgress
							currentSecond: $scope.currentSecond
							duration: $scope.getDuration()
						}
				else if playerState == YT.PlayerState.ENDED
					stopListeningForProgress()
					$scope.$apply ()->
						resetPlayer()
						$scope.$emit "#{playerEvents.ENDED}", {}
				else if playerState == YT.PlayerState.BUFFERING
					stopListeningForProgress()
					$scope.$emit "#{playerEvents.BUFFERING}", {}

			# External call
			$scope.$on 'YTI.ExtEvents.CallFn', (e, data)->
				# call to simple $scope function
				# data = function name
				if angular.isString(data) and angular.isFunction($scope[data])
					$scope[data]()

			return $scope
	])

	.directive('youtubeIframe', [
		'$log'
		'YTI.Api'
		'$timeout'
		'$window'
		($log, ytiApi, $timeout, $window)->

			###
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

			###

			return {
				restrict: 'AE'
				controller: 'YTI.PlayerController'
				scope:
					# videoId: '@'
					# ratio: '@'
					height: '@'
					width: '@'
					safeautoplay: '@' # issue with "autoplay" attribute name
					chromeless: '@' # without any youtube branding
				transclude: true
				template: '<div id="{{playerId}}" yti-player></div><div yti-overlay ng-transclude ng-class="{\'touch-enabled\':hasEverPlayed}"></div>'
				link: (scope, element, attrs, ctrl)->

					angular.extend scope, {
						playerId : "#{attrs.id}-ytplayer"
						ytPlayer : null
						relativeHeight: null
					}

					_playerCreated = false
					_mouseMoveTimer = null

					if !scope.ratio
						scope.ratio = 9/16

					_calcPlayerSize = ()->
						scope.relativeHeight = Math.round(element.width()*scope.ratio)

					_clearTimer = ()->
						if _mouseMoveTimer
							$timeout.cancel _mouseMoveTimer
							_mouseMoveTimer = null

					_showControls = ()->
						element.removeClass 'hide-controls'

					_hideControls = ()->
						element.addClass 'hide-controls'

					_createPlayer = ()->
						# Safe Player Creation using promise (wait for the API to be ready)
						ytiApi.createPlayer( scope.playerId, {
							height: if scope.height then scope.height else 270
							width: if scope.width then scope.width else 480
							videoId: scope.videoId
							playerVars:
								modestbranding: if scope.chromeless then 1 else 0
								controls: if scope.chromeless then 0 else 1
								showinfo: if scope.chromeless then 0 else 1
								autoplay: if scope.safeautoplay then 1 else 0
								rel: if scope.chromeless then 0 else 1
								version: 3
								wmode: "transparent"
							events:
								onReady: ctrl.onReady
								onStateChange: ctrl.onStateChange
						})
						.then((ytPlayer)->
							scope.ytPlayer = ytPlayer # store youtube player
							_playerCreated = true
						, (err)->
							$log.error(err);
						)

					_queueNewVideo = ()->
						ctrl.cueVideoById scope.videoId

					# if witdh is percentages, define height via js
					if scope.width and scope.width.slice(-1)=="%"
						scope.$watch 'relativeHeight', (newHeight)->
							element.css 'height', newHeight
						
						angular.element($window).on 'resize', (e)->
							_calcPlayerSize()

						_calcPlayerSize()

					# Support either string or variable for videoId
					if attrs.videoId
						if scope.$parent[attrs.videoId]
							scope.$watch ()->
								return scope.$parent[attrs.videoId]
							, (newVideoId)->
								if(newVideoId)
									scope.videoId = newVideoId
									if !_playerCreated
										_createPlayer()
									else
										_queueNewVideo()

						else if angular.isString(attrs.videoId)
							scope.videoId = attrs.videoId
							_createPlayer()

					ctrl.$watch ()-> 
						return ctrl.isMuted
					, (isMuted)->
						if isMuted
							element.addClass 'is-muted'
						else
							element.removeClass 'is-muted'

					ctrl.$watch ()-> 
						return ctrl.isFullscreen
					, (isFullscreen)->
						video = element[0]
						return false if !video
						if isFullscreen
							element.addClass 'is-fullscreen'
							if video.requestFullscreen
								video.requestFullscreen()
							else if video.msRequestFullscreen
								video.msRequestFullscreen()
							else if video.mozRequestFullScreen
								video.mozRequestFullScreen()
							else if video.webkitRequestFullscreen
								video.webkitRequestFullscreen()
						else
							element.removeClass 'is-fullscreen'
							if document.exitFullscreen
								document.exitFullscreen()
							else if document.msExitFullscreen
								document.msExitFullscreen()
							else if document.mozCancelFullScreen
								document.mozCancelFullScreen()
							else if document.webkitCancelFullScreen
								document.webkitCancelFullScreen()
							

					ctrl.$watch ()-> 
						return ctrl.isPlaying
					, (isPlaying)->
						_clearTimer()

						if isPlaying
							element.addClass 'is-playing'
							# _hideControls()
							element.triggerHandler 'mousemove'
						else
							element.removeClass 'is-playing'
							_showControls()

					element.on 'mouseleave', ()->
						if ctrl.isPlaying
							_clearTimer()
							_hideControls()

					element.on 'mousemove', ()->
						if ctrl.isPlaying
							_showControls()
							_clearTimer()
							_mouseMoveTimer = $timeout ()->
								_hideControls()
							, 2000
					
					return @
			}
	])

	.directive('ytiPlayPause', [
		()->

			###
				@directive ytiPlayPause

				@desc
					Play/Pause toggler
					/!\ Should be a child of "youtubeIframe" directive

				@example
					<any yti-play-pause></any>

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				link: (scope, element, attrs, iframeCtrl)->

					element.on 'click', (e)->
						e.preventDefault()
						iframeCtrl.togglePlay()
						scope.$apply()

					return @
			}
	])

	.directive('ytiSound', [
		()->

			###
				@directive ytiSound

				@desc
					Sound toggler
					/!\ Should be a child of "youtubeIframe" directive

					TODO:
						- add sound volume control

				@example
					<any yti-sound></any>

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				link: (scope, element, attrs, iframeCtrl)->

					element.on 'click', (e)->
						e.preventDefault()
						iframeCtrl.toggleSound()
						scope.$apply()

					return @
			}
	])

	.directive('ytiFullscreen', [
		()->

			###
				@directive ytiFullscreen

				@desc
					Fullscreen toggler
					/!\ Should be a child of "youtubeIframe" directive

				@example
					<any yti-fullscreen></any>

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				link: (scope, element, attrs, iframeCtrl)->

					element.on 'click', (e)->
						e.preventDefault()
						iframeCtrl.toggleFullscreen()
						scope.$apply()

					return @
			}
	])

	.directive('ytiCurrentTime', [
		'YTI.TimeHelper'
		(timeHelper)->

			###
				@directive ytiCurrentTime

				@desc
					Display the current time of the video
					/!\ Should be a child of "youtubeIframe" directive

				@example
					<any yti-current-time></any>

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				scope: true
				replace: true
				template: '<div>{{time}}</div>'
				link: (scope, element, attrs, iframeCtrl)->

					scope.time = timeHelper.secondsToTimeString 0

					iframeCtrl.$watch ()-> 
						return iframeCtrl.currentSecond
					, (currentSecond)->
						if currentSecond
							scope.time = timeHelper.secondsToTimeString currentSecond
						else
							scope.time = timeHelper.secondsToTimeString 0

					return @
			}
	])

	.directive('ytiDuration', [
		'YTI.TimeHelper'
		(timeHelper)->

			###
				@directive ytiDuration

				@desc
					Display the total duration the video
					/!\ Should be a child of "youtubeIframe" directive

				@example
					<any yti-duration></any>

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				scope: true
				replace: true
				template: '<div>{{duration}}</div>'
				link: (scope, element, attrs, iframeCtrl)->

					scope.duration = timeHelper.secondsToTimeString 0

					scope.$watch ()->
						return iframeCtrl.isPlayerReady
					, (newValue)->
						if newValue
							scope.duration = timeHelper.secondsToTimeString iframeCtrl.getDuration()

					return @
			}
	])

	.directive('ytiPosterFrame', [
		'YTI.PlayerEvents'
		(playerEvents)->

			###
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

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				scope:
					img: '@'
				replace: true
				template: '<div style="background-image:url({{img}});" ng-class="{visible:shouldBeVisible}"></div>'
				link: (scope, element, attrs, iframeCtrl)->

					angular.extend scope, {
						shouldBeVisible: true
					}

					scope.$watch ()->
						return iframeCtrl.isPlaying
					, (newValue)->
						scope.shouldBeVisible = false if newValue

					iframeCtrl.$on "#{playerEvents.ENDED}", (e)->
						scope.shouldBeVisible = true

					return @
			}
	])

	.directive('ytiProgressBar', [
		()->

			###
				@directive ytiProgressBar

				@desc
					The video progress bar
					/!\ Should be a child of "youtubeIframe" directive

					TODO:
						- add timeline feedback for mouse interactions

				@example
					<any yti-progress-bar></any>

			###

			return {
				restrict: 'A'
				require: '^youtubeIframe'
				scope: true
				replace: true
				template: '<div class="yti-progress-bar-container">
					<div class="yti-progress-bar" style="width:{{percent}}%"></div>
					<div class="yti-progress-tilt" style="left:{{percent}}%"></div>
				</div>'
				link: (scope, element, attrs, iframeCtrl)->

					angular.extend scope, {
						percent: 0
					}

					element.on 'click', (e)->
						e.preventDefault()
						percentPos = e.offsetX/element.width()
						iframeCtrl.seekTo(iframeCtrl.getDuration()*percentPos)
						iframeCtrl.play()
						scope.$apply()
						return

					# listen for the video progressEvent
					# to display a video timeline
					iframeCtrl.$watch ()-> 
						return iframeCtrl.currentProgress
					, (currentProgress, oldCurrentProgress)->
						scope.percent = currentProgress

					return @
			}
	])