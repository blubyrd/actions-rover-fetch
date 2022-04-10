import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as artifact from '@actions/artifact'
import * as fs from 'fs'
import * as path from 'path'

const uploadArtifact = async (name: string, path: string) => {
  const client = artifact.create()
  const options = { continueOnError: false }
  return await client.uploadArtifact(name, [path], __dirname, options)
}

const saveFile = (name: string, schema: string | NodeJS.ArrayBufferView) => {
  const file = path.join(__dirname, `/${name}`)
  fs.writeFileSync(file, schema)
  return file
}

const rover = async (args: string[] = []) => {
  let schema = ""
  const stdout = (data: { toString: () => string }) => schema += data.toString()
  const listeners = { stdout }
  const options = { listeners }
  await exec.exec("/root/.rover/bin/rover", args, options)
  return schema
}

const getInput = () => {
  const graph = core.getInput('graph')
  const variant = core.getInput('variant')
  const federated = core.getInput('federated')
  const subgraph = core.getInput('subgraph')
  if (federated && !subgraph) throw new Error('federated graph requires subgraph input')
  const path = federated ? `./${subgraph}.graphql` : `./graph.graphql`
  return { graph, variant, federated, subgraph, path }
}

const setOutput = (schema: any) => {
  const encoded = Buffer.from(schema).toString('base64')
  core.setOutput('schema', encoded)
}

async function run() {
  try {
    const { graph, variant, federated, subgraph, path } = getInput()
    const name = federated ? ['--name', subgraph] : []
    const args = [
      federated ? 'subgraph' : 'graph',
      'fetch',
      `${graph}@${variant}`,
      ...name
    ]
    const schema = await rover(args)
    const filename = federated ? `${subgraph}.graphql` : `graph.graphql`
    const file = saveFile(filename, schema)
    await uploadArtifact(filename, file)
    setOutput(schema)
  } catch (error: any) {
    console.error(error)
    core.setFailed(error.message)
  }
}

run()