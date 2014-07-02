<!DOCTYPE html>
<!--[if lt IE 7]>      <html class="lt-ie9 lt-ie8 lt-ie7"> <![endif]-->
<!--[if IE 7]>         <html class="lt-ie9 lt-ie8"> <![endif]-->
<!--[if IE 8]>         <html class="lt-ie9"> <![endif]-->
<!--[if gt IE 8]><!--> <html class=""> <!--<![endif]-->
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Youtube Iframe Angular directive</title>
        <meta name="description" content="">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <style>
            [yti-progress-bar] {
                position: relative;
                height: 10px;
                background-color: #ddd;
            }
            [yti-progress-bar] .yti-progress-bar {
                position: absolute;
                top: 0;
                left: 0;
                z-index: 0;
                height: 100%;
                background-color: #F00;
            }
            [yti-progress-bar] .yti-progress-tilt {
                position: absolute;
                top: 0;
                left: 0;
                z-index: 1;
                height: 100%;
                width: 2px;
                background-color: #FFF;
            }
        </style>
    </head>
    <body ng-app="youtubeIframeApp">
        <h1>Player Demo</h1>

        <div youtube-iframe id="test" video-id="fFtSf1tfzZk">
            <div yti-progress-bar></div>
            <div>
                <a href="" yti-play-pause>Play/Pause toggler</a>
            </div>
            <div>
                <a href="" yti-sound>Sound toggler</a>
            </div>
            <div>
                <a href="" yti-fullscreen>Fullscreen toggler</a>
            </div>
            <div>duration: <div yti-duration></div></div>
            <div>current time: <div yti-current-time></div></div>
        </div>

        <script src="../bower_components/angular/angular.js"></script>
        <script src="../src/js/youtube-iframe.js"></script>
        <script>
            console.log('yooo');
            angular.module('youtubeIframeApp', ['sg.youtube']);
            console.log('end');
        </script>
    </body>
</html>
