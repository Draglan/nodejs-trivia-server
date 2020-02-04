const trivia = require('./trivia-room');
const axios  = require('axios');

let categories = [];

function getTriviaQuestionAsync(config, onComplete, onError)
{
    let url = 'https://opentdb.com/api.php?amount=1';

    if (config.difficulty.length > 0) url += `&difficulty=${config.difficulty}`;
    if (config.category != -1)        url += `&category=${config.category}`;

    console.log(config);
    console.log('getting from url' + url);

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
                let triviaQuestion        = new trivia.TriviaQuestion(question, answers, correctIndex);
                triviaQuestion.category   = response.category;
                triviaQuestion.difficulty = response.difficulty;

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
function getCategories()
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

module.exports.getTriviaQuestionAsync = getTriviaQuestionAsync;
module.exports.getCategories          = getCategories;