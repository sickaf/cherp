module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    // concat: {
    //   options: {
    //     separator: ';'
    //   },
    //   dist: {
    //     src: ['src/js/*.js'],
    //     dest: 'public/js/<%= pkg.name %>.js'
    //   }
    // },
    // copy: {
    //   main: {
    //     files: [
    //       // includes files within path
    //       {expand: true, flatten: true, src: ['src/*'], dest: 'public', filter: 'isFile'},

    //       {expand: true, flatten: true, src: ['src/img/*'], dest: 'public/img', filter: 'isFile'},

    //       {expand: true, flatten: true, src: ['src/fonts/*'], dest: 'public/fonts', filter: 'isFile'},

    //       {expand: true, flatten: true, src: ['src/js/bootstrap.min.js'], dest: 'public/js'},
    //       {expand: true, flatten: true, src: ['src/js/spin.min.js'], dest: 'public/js'},

    //       {expand: true, flatten: true, src: ['src/css/bootstrap-theme.min.css'], dest: 'public/css'},
    //       {expand: true, flatten: true, src: ['src/css/bootstrap.min.css'],       dest: 'public/css'},
    //       {expand: true, flatten: true, src: ['src/css/confirmation-style.css'],  dest: 'public/css'},

    //       // // includes files within path and its sub-directories
    //       // {expand: true, src: ['path/**'], dest: 'dest/'},

    //       // // makes all src relative to cwd
    //       // {expand: true, cwd: 'path/', src: ['**'], dest: 'dest/'},

    //       // // flattens results to a single level
    //       // {expand: true, flatten: true, src: ['path/**'], dest: 'dest/', filter: 'isFile'},
    //     ],
    //   },
    // },
    // cssmin: {
    //   dist: {
    //     src: ['src/css/style.css'],
    //     dest: 'public/css/<%= pkg.name %>.min.css'
    //   }
    // },
    // uglify: {
    //   options: {
    //     banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
    //   },
    //   dist: {
    //     files: {
    //       'public/js/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
    //     }
    //   }
    // },
    jshint: {
      files: ['Gruntfile.js', 'public/js/client.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        }
      }
    },
    csslint: {
      options: {
        csslintrc: '.csslintrc'
      },
      lax: {
        options: {
          import: false
        },
        src: ['public/css/style.css']
      }
    }
  });

  // grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-csslint');
  // grunt.loadNpmTasks('grunt-contrib-concat');
  // grunt.loadNpmTasks('grunt-contrib-cssmin');
  // grunt.loadNpmTasks('grunt-contrib-copy');


  // grunt.registerTask('default', ['jshint', 'concat', 'uglify', 'csslint', 'cssmin', 'copy']);
  grunt.registerTask('default', ['jshint', 'csslint']);

};
