const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwttoken = require('jsonwebtoken')

let db = null
const app = express()
app.use(express.json())

const databasePath = path.join(__dirname, 'twitterClone.db')

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

app.post('/register/', async (request, response) => {
  const {name, username, password, gender} = request.body

  let checkTheUsername = `
            SELECT *
            FROM user
            WHERE username = '${username}';`
  let userData = await db.get(checkTheUsername)
  if (userData === undefined) {
    let postNewUserQuery = `
            INSERT INTO
            user (name,username,password,gender)
            VALUES (
                '${name}',
                '${username}',
                '${password}',
                '${gender}'
            );`
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      let newUserDetails = await db.run(postNewUserQuery)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  let checkTheUsername = `
            SELECT *
            FROM user
            WHERE username = '${username}';`
  let userData = await db.get(checkTheUsername)
  if (userData !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, userData.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwttoken.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

const check = (request, respond, next) => {
  let jwt
  const header = request.headers['authorization']
  if (header != undefined) {
    jwt = header.split(' ')[1]
  }
  if (jwt === undefined) {
    respond.status(401)
    respond.send('Invalid JWT Token')
  } else {
    jwttoken.verify(jwt, 'MY_SECRET_TOKEN', async (err, payload) => {
      if (err) {
        respond.status(401)
        respond.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.get('/user/tweets/feed/', check, async (request, respond) => {
  let {username} = request

  const userIdQuery = `
  SELECT user_id FROM user
  WHERE username = '${username}'`
  const {user_id} = await db.get(userIdQuery)
  try {
    const api3 = `SELECT T.username, T.tweet, T.date_time as dateTime 
    FROM (user INNER JOIN tweet ON tweet.user_id = user.user_id) AS T
    INNER JOIN  follower ON T.user_id = follower.follower_user_id 
    WHERE follower.following_user_id = '${user_id}'
    ORDER BY date_time LIMIT 4 OFFSET 0;`
    const tweets = await db.all(api3)
    respond.send(tweets)
  } catch (e) {
    console.log('get api error : ' + e)
  }
})

module.exports = app
