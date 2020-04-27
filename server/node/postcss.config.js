// postcss.config.js
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
    require('@fullhuman/postcss-purgecss')({
      // Specify the paths to all of the template files in your project
      content: ['./client/**/*.html'],

      // Include any special characters you're using in this regular expression
      defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ],
};
