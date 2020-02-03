const trivia = require('./trivia-room');
const axios  = require('axios');

let allQuestions = [];
let isInitialized = false;

function getTriviaQuestion() 
{
    if (!isInitialized)
    {
        for (let i = 0; i < 50; ++i)
        {
            allQuestions.push
            (
                new trivia.TriviaQuestion(`Question ${i}`, ['Answer1', 'Answer2'], 0)
            );
        }

        isInitialized = true;
    }

    return allQuestions[Math.floor(Math.random() * allQuestions.length)];
}

function getTriviaQuestionAsync(onComplete, onError)
{
    axios.get('https://opentdb.com/api.php?amount=1')
        .then
        (
            response =>
            {
                response = response.data.results[0];
                /*console.log(response);*/

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

module.exports.getTriviaQuestion      = getTriviaQuestion;
module.exports.getTriviaQuestionAsync = getTriviaQuestionAsync;