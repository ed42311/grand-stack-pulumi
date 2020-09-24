// import * as pulumi from '@pulumi/pulumi'
import * as awsx from '@pulumi/awsx'
import { lambda } from '@pulumi/aws'
import { ApolloServer } from 'apollo-server-lambda'
import neo4j from 'neo4j-driver'
import {
  APIGatewayProxyEvent,
  Callback,
  APIGatewayProxyResult,
} from 'aws-lambda'

// We need some types up in here
// https://github.com/neo4j-graphql/neo4j-graphql-js/issues/275
// eslint-disable-next-line
const neo4jGraphqlJs = require('neo4j-graphql-js')
const { makeAugmentedSchema } = neo4jGraphqlJs

const AwsLambdaContextForPulumiContext = (
  pulumiContext: lambda.Context
): AWSLambda.Context => {
  const lambdaContext: AWSLambda.Context = {
    done() {
      throw new Error('done is just a placeholder ')
    },
    fail() {
      throw new Error('fail is just a placeholder ')
    },
    succeed() {
      throw new Error('succeed is just a placeholder ')
    },
    ...pulumiContext,
    getRemainingTimeInMillis: () =>
      parseInt(pulumiContext.getRemainingTimeInMillis(), 10),
    memoryLimitInMB: pulumiContext.memoryLimitInMB,
  }
  return lambdaContext
}

// https://github.com/fanout/apollo-serverless-demo
// https://raw.githubusercontent.com/serverless/serverless-graphql/master/app-backend/rest-api/resolvers.js

// This is our whole stack, kinda cool
// Create a public HTTP endpoint (using AWS APIGateway)
const endpoint = new awsx.apigateway.API('hello', {
  routes: [
    // Serve static files from the `www` folder (using AWS S3)
    {
      path: '/',
      localPath: 'www',
    },
    {
      path: '/source',
      method: 'GET',
      eventHandler: (req, ctx, cb) => {
        cb(undefined, {
          statusCode: 200,
          body: Buffer.from(JSON.stringify({ name: 'AWS' }), 'utf8').toString(
            'base64'
          ),
          isBase64Encoded: true,
          headers: { 'content-type': 'application/json' },
        })
      },
    },
    {
      path: '/graphql',
      method: 'POST',
      eventHandler: (
        event: APIGatewayProxyEvent,
        context: lambda.Context,
        callback: Callback<APIGatewayProxyResult>
      ) => {
        // This is our backend, it holds our schema
        // Our Apollo instance and our connection credentials to our sandbox
        const awsContext = AwsLambdaContextForPulumiContext(context)
        // load from a schema file
        // $ curl -d '{"query": "query {hello}"}' $(pulumi stack output endpoint)/graphql
        // $ curl -d '{"query": "Movie(title: \"Cloud Atlas\") {title}"}' https://qtta34wlsg.execute-api.us-west-2.amazonaws.com/stage/graphql
        const typeDefs = `
type Movie {
  movieId: ID!
  title: String
  year: Int
  plot: String
  poster: String
  imdbRating: Float
  similar(first: Int = 3, offset: Int = 0): [Movie] @cypher(statement: "MATCH (this)-[:IN_GENRE]->(:Genre)<-[:IN_GENRE]-(o:Movie) RETURN o")
  degree: Int @cypher(statement: "RETURN SIZE((this)-->())")
  actors(first: Int = 3, offset: Int = 0): [Actor] @relation(name: "ACTED_IN", direction:"IN")
}

type Actor {
  id: ID!
  name: String
  movies: [Movie]
}

type Query {
  Movie(id: ID, title: String, year: Int, imdbRating: Float, first: Int, offset: Int): [Movie]
}
`
        const schema = makeAugmentedSchema({ typeDefs })
        const driver = neo4j.driver(
          'bolt://100.26.252.113:33279',
          neo4j.auth.basic('neo4j', 'zips-toe-lapse')
        )
        const server = new ApolloServer({
          schema,
          context: { driver },
        })
        server.createHandler()(event, awsContext, callback)
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
