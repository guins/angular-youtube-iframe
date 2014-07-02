gulp = require 'gulp'
gutil = require 'gulp-util'
coffee = require 'gulp-coffee'

paths = 
	scripts: ['./src/coffee/**.coffee']

gulp.task 'scripts', ()->
	gulp
		.src paths.scripts
		.pipe coffee({bare: true}).on('error', gutil.log)
		.pipe gulp.dest('src/js/')

gulp.task 'watch', ()->
	gulp.watch paths.scripts, ['scripts']

gulp.task 'default', ['watch']