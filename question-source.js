const trivia = require('./trivia-room');
const axios  = require('axios');

let categories = [];

// Returns a Promise that resolves when initialization is complete.
// Put any code that should go after this module initializes in the
// 'then' part of the returned Promise.
function init()
{
    return loadCategories();
}

function getTriviaQuestionAsync(config, onComplete, onError)
{
    let url = 'https://opentdb.com/api.php?amount=1';

    if (config.hasDifficulty()) url += `&difficulty=${config.difficulty}`;
    if (config.hasCategory())   url += `&category=${config.category.id}`;

    axios.get(url)
        .then
        (
            response =>
            {
                response = response.data.results[0];

                // Get the question data we want from the API response.
                let question = response.question;
                let answers  = response.incorrect_answers;
                answers.push(response.correct_answer);

                // Shuffle the answer list so it isn't in the same order each time.
                for (let i = 0; i < answers.length; ++i)
                {
                    let tmp           = answers[i];
                    let newIndex      = Math.floor(Math.random() * answers.length);

                    answers[i]        = answers[newIndex];
                    answers[newIndex] = tmp;
                }

                // Find the index of the correct answer in the answer list.
                let correctIndex = answers.findIndex((a) => a === response.correct_answer);

                // Construct the TriviaQuestion object that will represent the question.
                let triviaQuestion            = new trivia.TriviaQuestion(question, answers, correctIndex);
                triviaQuestion.categoryName   = response.category;
                triviaQuestion.difficulty     = response.difficulty;

                onComplete(triviaQuestion);
            }
        )
        .catch(error => onError(error));
}

// Return a promise that resolves with an array of all of the
// categories provided by the question source. Each category
// is an object with two parameters: id (a number), and name
// (a string).
//
// Example: [ {id: 9, name: "General Knowledge"}, ... ]
function loadCategories()
{ 
    if (categories.length === 0)
    {
        // If the response isn't cached, make a request for the
        // category list.
        return axios.get('https://opentdb.com/api_category.php')
            .then
            (
                response =>
                {
                    categories = response.data.trivia_categories;
                    return categories;
                }
            );
    }
    else
    {
        // ...Otherwise, return the cached response.
        return new Promise
        (
            (resolve, _) => resolve(categories)
        );
    }
}

// Return the Category object with the given ID, or undefined
// if no such category exists.
function getCategoryById(id)
{
    return categories.find(c => c.id === id);
}

// Returns a list of all of the available categories as an array
// of Category objects. Be sure you have called loadCategories()
// first, and that the promise returned by loadCategories()
// has resolved.
function getCategories()
{
    return categories;
}

module.exports.getTriviaQuestionAsync = getTriviaQuestionAsync;
module.exports.loadCategories         = loadCategories;
module.exports.getCategories          = getCategories;
module.exports.getCategoryById        = getCategoryById;
module.exports.init                   = init;