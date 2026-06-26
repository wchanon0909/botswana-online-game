services:
  - type: web
    name: botswana-online-game
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_VERSION
        value: 20
      - key: NPM_CONFIG_REGISTRY
        value: https://registry.npmjs.org/
