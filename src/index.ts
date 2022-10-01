import * as ReactDOM from "react-dom"
import * as React from "react"
import { useState, useEffect, useRef } from "react"
import App from "./App"
import { BrainGenome } from "./BrainGenome"
import { randomGuassian } from "./common/math"

let app = new App()

// BrainGenome.test()

// ReactDOM.render(
//     <App.Render app={App.instance} />,
//     document.getElementById( "root" )
// )