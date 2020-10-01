// import * as pulumi from '@pulumi/pulumi'

import * as awsx from '@pulumi/awsx'
import { lambda } from '@pulumi/aws'
import {
  APIGatewayProxyEvent,
  Callback,
  APIGatewayProxyResult,
} from 'aws-lambda'

import { ApolloServer } from 'apollo-server-lambda'

import neo4j from 'neo4j-driver'

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

// This is our whole stack, kinda cool
// Create a public HTTP endpoint (using AWS APIGateway)
const endpoint = new awsx.apigateway.API('hello', {
  routes: [
    {
      path: '/',
      method: 'ANY',
      eventHandler: (
        event: APIGatewayProxyEvent,
        context: lambda.Context,
        callback: Callback<APIGatewayProxyResult>
      ) => {
        const awsContext = AwsLambdaContextForPulumiContext(context)
        // $ curl -d '{"query": "query {hello}"}' $(pulumi stack output endpoint)/
        // $ curl -d '{"query": "Movie(title: \"Cloud Atlas\") {title}"}' https://qtta34wlsg.execute-api.us-west-2.amazonaws.com/stage/
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
          'bolt://54.146.86.84:33082',
          neo4j.auth.basic('neo4j', 'waves-raise-talks')
        )
        const server = new ApolloServer({
          schema,
          introspection: true,
          playground: {
            endpoint: '/dev/graphql',
          },
          context: { driver },
        })

        if (event.httpMethod === 'GET') {
          server.createHandler()(
            { ...event, path: event.requestContext.path || event.path },
            awsContext,
            callback
          )
        } else {
          server.createHandler()(event, awsContext, callback)
        }
        server.createHandler()(event, awsContext, callback)
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
