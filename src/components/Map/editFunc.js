//import const from map.js
import {sketch, view, featLayer, gLayer, countyOfficialInfo, map, rdbdSrfcAsst, rdbdDsgnAsst, rdbdNameAsst, rdbdLaneAsst, editsLayer,rdbdAsset} from '../Map/map'
import {cntyNbrNm} from '../../common/txCnt'
import {roadInfo} from '../../store'
//esri js geometry engine import
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Graphic from "@arcgis/core/Graphic";
import Query from "@arcgis/core/rest/support/Query";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import esriId from "@arcgis/core/identity/IdentityManager";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils"
import * as geodesicUtils from "@arcgis/core/geometry/support/geodesicUtils";
import { criConstants } from '../../common/cri_constants';

//add login info
export function login(){
  let auth = new OAuthInfo({
    appId:"Chsd9GwkzlckpRBr",
    expiration: 10080,
    popup: false,
    portalUrl: "https://txdot.maps.arcgis.com",
  })
  console.log(esriId.findfindOAuthInfo(auth.portalUrl))
  esriId.registerOAuthInfos([auth]);
  const id = esriId.getCredential(auth.portalUrl + "/sharing");
  console.log(id)
}
function queryFeat(qry){
  let queryFeat = featLayer.queryFeatures({
    objectIds: [qry.results[0].graphic.attributes.objectid],
    outFields: ["*"],
    returnGeometry: true,
    returnM: true
  })
  return queryFeat
}

async function queryFeatureTables(tblqry){
  const query = new Query();
  query.where = `RDBD_GMTRY_LN_ID = ${tblqry.features[0].attributes.gid}`
  query.outFields = [ "*" ]
  const rdbdSrfc = rdbdSrfcAsst.queryFeatures(query)
  const rdbdDsgn = rdbdDsgnAsst.queryFeatures(query)
  const rdbdName = rdbdNameAsst.queryFeatures(query)
  const rdbdLane = rdbdLaneAsst.queryFeatures(query)
  const rdbdSrfcAtt = await rdbdSrfc
  const rdbdDsgnAtt = await rdbdDsgn
  const rdbdNameAtt = await rdbdName
  const rdbdLaneAtt = await rdbdLane
  console.log(rdbdSrfcAtt)
  let rdbdSrfArry = [];
  if(rdbdSrfArry.length){
    rdbdSrfArry.length = 0
  }
  for(let srf in rdbdSrfcAtt.features){
    let surface = criConstants.surface
    for(let i in surface){
      if(surface[i]['num'] === rdbdSrfcAtt.features[srf].attributes.srfc_type_id){
        rdbdSrfcAtt.features[srf].attributes.srfc_type_id = surface[i]['name']
      }
    }
    rdbdSrfArry.push(rdbdSrfcAtt.features[srf].attributes)
  }
  console.log(rdbdSrfArry)
  rdbdSrfArry.sort((a,b)=>(a.asset_ln_begin_dfo_ms > b.asset_ln_begin_dfo_ms)? 1:-1)
  roadInfo.getSurface = rdbdSrfArry
  roadInfo.getDesign = rdbdDsgnAtt.features[0].attributes.rdway_dsgn_type_dscr
  roadInfo.getName = rdbdNameAtt.features[0].attributes.st_defn_nm
  roadInfo.getLane = rdbdLaneAtt.features[0].attributes.nbr_thru_lane_cnt
}
//get county name and road totals
export async function countyInfo(){
  let countyInfoPromise =  new Promise(function(res){
    let queryUrl = window.location.href
    let crInfo = queryUrl.split('https://dprosack.github.io/DUSAPrototype')[1]
    //console.log(crInfo.toString())
    for (let j=0; j < cntyNbrNm.length; j++){
      console.log(cntyNbrNm[j][crInfo])
      if(cntyNbrNm[j][crInfo]){
        let whereStatement = `County_NBR = '${crInfo}'`
        roadInfo.getcntyNmbr = crInfo
        roadInfo.getcntyName = cntyNbrNm[j][crInfo]
        console.log(whereStatement)
        const query = new Query();
        query.where = whereStatement
        query.outFields = [ "*" ]
        let newQuery = countyOfficialInfo.queryFeatures(query)
        res({response:true, nbr:parseInt(crInfo), query:newQuery})
      }
      else{
        res({response:false})
      }
    }
    //let crValidation = /^[0-9]{1,3}$/
  })
  
  let countyInfoReturn = await countyInfoPromise;
  return countyInfoReturn
}

export async function addRoadbed(){
    return await new Promise(function(res){
        sketch.create("polyline",{mode:"click", hasZ: false})
        sketch.on('create', (event) => {
            let lengthMiles;
            if(event.state === "complete"){
                //console.log("This is the previous total length: ",this.previousTotal)
                lengthMiles = geometryEngine.geodesicLength(event.graphic.geometry, "miles")
                //addLen(lengthMiles);
                console.log("This is the current line length: ", parseFloat(lengthMiles.toFixed(3)));
                res(lengthMiles);
            }
        });
    }) 
}

export async function modifyRoadbed(clickType){
  let promise = new Promise(function(res){
    view.on(clickType, (event) => {
      let opts = { include: featLayer }
      view.hitTest(event, opts).then(function(response){
        for(let i=0; i < response.results.length; i++){
          if(response.results[i].graphic.geometry !== null && response.results[i].graphic.sourceLayer !== null){
            let test = queryFeat(response)
            test.then(result=>res(result))
          }
        }
      })
    })
  })

  let feature = await promise;
  console.log(feature)
  //rdbdSrfc.then(result => console.log(result))
  await queryFeatureTables(feature)
  defineGraphic(feature,clickType)
  if(clickType === "immediate-click"){
    return 1
  }
  return feature//geometryEngine.geodesicLength(feature.features[0].geometry, "miles")
}

export function zoomExtents(){
  view.on('mouse-wheel',() => {
    console.log(view.zoom)
    view.zoom < 9 ?  featLayer.visible = false : featLayer.visible = true;
    view.zoom < 9 ? map.basemap = criConstants.basemap : map.basemap = 'satellite'
    view.zoom > 9 ? map.basemap = 'satellite' : criConstants.basemap
  })
}

export function hightlightFeat(){
  view.on('pointer-move', (event) => {
    const opts = {include: featLayer}
    view.hitTest(event, opts).then(function(response){
      if (response.results.length) {
        let editFeature = response.results[0].graphic;
        view.whenLayerView(editFeature.layer).then(function(layerView){
          let highlight = layerView.highlight(editFeature);
          view.on('pointer-move', (event) => {
            view.hitTest(event, opts).then(function(response){
              if(response.results.length === 0){
                highlight.remove()
              }
            })
          })
        })
      }
    })
  })
}

function defineGraphic(graphics, clickType){
  if (clickType === "double-click"){
    let newGraphic = new Graphic({
    geometry: {
      type: "polyline",
      paths: graphics.features[0].geometry.paths[0],
      hasM: true,
      spatialReference: {
        wkid: 3857
      }
    },

    attributes: {
      gid: graphics.features[0].attributes.gid,
      objectid: graphics.features[0].attributes.objectid,
      roadbedName: roadInfo.getName,
      roadbedDesign: roadInfo.getDesign,
      roadbedSurface: roadInfo.getSurface,
      numLane: roadInfo.getLane,
      createDt: new Date().getTime(),
      createNm: "DPROSACK"
    },
              
    symbol: {
      type: "simple-line",
      color: [0, 0, 255],
      width: 2,
      style: "dash"
    }
  })
  let objectidList = [];
  gLayer.graphics.add(newGraphic);
  console.log(gLayer.graphics)
  
  for(let id in gLayer.graphics.items)
    if(gLayer.graphics.items[id].attributes !== null){
      objectidList.push(gLayer.graphics.items[id].attributes.gid)
    }
    console.log(objectidList)
    featLayer.definitionExpression = `gid not in (${objectidList}) and cnty_nm = '${roadInfo.getcntyName}'`
    //rdbdSrfcGeom.definitionExpression = `gid not in (${objectidList}) and cnty_nm = '${roadInfo.getcntyName}'`
  }
}

export async function updateLength(){
  let oldLength;
  view.on("click", function (event) {
    let opts = {include: gLayer}
    if (sketch.state === "active") {
      return;
    }
    
    view.hitTest(event,opts)
      .then(function (response) {
        let results = response.results;
        results.forEach(function (result) {
          if(result.graphic.layer === sketch.layer && result.graphic.attributes)
          {
            sketch.update([result.graphic], { tool: "reshape" });
          }
          if(result.graphic.layer === sketch.layer && !result.graphic.attributes)
          {
            sketch.update([result.graphic], { tool: "reshape" });
          }
        });
        oldLength = geometryEngine.geodesicLength(response.results[0].graphic.geometry, "miles")
      })
      .catch(err => err)
    });
  
  let updatePromise = new Promise(function(res){
    view.when(function(){
      sketch.on('update', (event)=>{
        let newLength;
    
        if(!event.toolEventInfo && event.state === 'complete'){
          newLength = geometryEngine.geodesicLength(event.graphics[0].geometry, "miles")
          sketch.complete();
        }
        const deltaLength = newLength - oldLength
        if(oldLength < newLength){
          //console.log('add')
          let addMiles = Math.abs(deltaLength)
          res(addMiles)
        }
        if (oldLength > newLength){
          //console.log('sub')
          let subMiles = -Math.abs(deltaLength)
          res(subMiles)
        }
      })
    })
  })
  updatePromise.catch(err => alert(err))
  let mileage = await updatePromise;
  
  return mileage
}

export function stopEditing(){
  sketch.cancel()
}

export async function getGraphic(){
  let getGraphPromise = new Promise(function(resp){
      view.on("immediate-click", function(event){
        let option = {include: gLayer}
        if (sketch.state === "active") {
          return;
        }
          view.when(function(){
            view.hitTest(event,option)
            .then(function(response){
              if(response.results.length){
                roadInfo.getObjectId = response.results[0].graphic.attributes !== null ? response.results[0].graphic.attributes['objectid'] : null
                roadInfo.getName = response.results[0].graphic.attributes !== null ? response.results[0].graphic.attributes['roadbedName'] : null
                roadInfo.roadbedSurface = response.results[0].graphic.attributes !== null ? response.results[0].graphic.attributes['roadbedSurface'] : null
                roadInfo.getDesign = response.results[0].graphic.attributes !== null ? response.results[0].graphic.attributes['roadbedDesign'] : null
                roadInfo.getSurface = response.results[0].graphic.attributes !== null ? response.results[0].graphic.attributes['roadbedSurface'] : null
                roadInfo.getLane = response.results[0].graphic.attributes !== null ? response.results[0].graphic.attributes['numLane'] : 0
                resp(1)
              }
            })
          })
      });
  });
 let returnGetGraph = await getGraphPromise;
 return returnGetGraph
}

// function reapplyM(arr){
//   let testArr = []
//   while(arr.length){
//     let split1 = arr.splice(0,2)
//     testArr.push(split1)
//   }
//   console.log(testArr)
//   for (let i=0; i < testArr.length; i++){
//     console.log(testArr[i])
//     //x2-x1
//     let xDiff = Math.pow(Math.abs(testArr[i][1][0] - testArr[i][0][0]), 2)
//     // console.log(xDiff)
//     //y2-y1
//     let yDiff = Math.pow(Math.abs(testArr[i][1][1] - testArr[i][0][1]), 2)
//     // console.log(yDiff)
//     const m = Math.sqrt(xDiff + yDiff) * 0.0006213712
//     console.log(m)
//     testArr[i][1].slice(3,0,m)
//   }
//   return testArr
//}

export function saveInfo(id){
  console.log(id)
  // let geom = gLayer.graphics.items[0].geometry.paths[0]
  // console.log(geom)
  // let copyGeom = [...geom]
  // console.log(reapplyM(copyGeom))
  const graphic = gLayer.graphics.items
  console.log(graphic)
  let geomPath;
  let createdate;
  let createName;
  let gid;
  for(let x in graphic){
    console.log(graphic[x].attributes)
    if(graphic[x].attributes.objectid === id.objectid){
      console.log(`${graphic[x].attributes.objectid} === ${id.objectid}`)
      console.log(graphic[x].attributes)
      console.log(graphic[x].geometry)
      geomPath = graphic[x].geometry
      createdate = graphic[x].attributes.createDt
      createName = graphic[x].attributes.createNm
      gid = graphic[x].attributes.gid
    }
  }
  console.log(JSON.stringify(id.rdbdSurf))
  const editGraphic = new Graphic({
    geometry: geomPath,
    attributes: {
      objectid: id.objectid,
      gid: gid,
      begin_dfo: 1,
      end_dfo: 1,
      seg_len:4,
      county: roadInfo.getcntyNmbr,
      edit_type:'update',
      create_nm: createName,
      create_dt: createdate,
      edit_nm: id.editNm,
      edit_dt: id.editDt,
      submit: 0,
      cnty_nbr: roadInfo.getcntyNmbr,
      srfc_type_id:id.rdbdSurfe,
      st_defn_nm: id.rdbdName,
      rdway_dsgn_type_dscr: id.rdbdDes,
      nbr_thru_lane_cnt: id.numLanes,
    }
  });
  console.log(editGraphic)
  editsLayer.applyEdits({
    addFeatures: [editGraphic]
  });
}

function createAssetGraph(pathArr,y){
  console.log(y)
  console.log(pathArr.paths[0].length)
  //let x = gLayer.graphics.items[0].geometry.paths[0]
  // let dens;
  // for(let id in gLayer.graphics.items){
  //   if(gLayer.graphics.items[id].attributes.objectid === y[0].objectid){
  //     dens = geometryEngine.densify(gLayer.graphics.items[id].geometry,.1)
  //   }
  // }
  // console.log(dens)
  let densUpdate = pathArr.paths[0]
  
  let mArr = [];
  if(mArr.length){
    mArr.length = 0
  }

  for(let i = 0; i < densUpdate.length; i++){
    //console.log(x[i][2])
    mArr.push(parseFloat(densUpdate[i][2]).toFixed(3)) //mval
  }
  for(let d in y){
    console.log(y[d].srfcType)
    if(y[d].srfcType === 'Paved'){
      let getstart = (element) => element >= y[d].AssetBeginDfo;
      let endstart = (element) => element >= y[d].AssetEndDfo;
      console.log(mArr.findIndex(getstart))
      console.log(mArr.findIndex(endstart))
      let geom = densUpdate.slice(mArr.findIndex(getstart), mArr.findIndex(endstart)+1)
      console.log(geom)
      let pavement = new Graphic({
        geometry: {
          type: "polyline",
          paths: geom,
          hasM: true,
          spatialReference: {
            wkid: 3857
          }
        },
    
        attributes: {
          objectid: gLayer.graphics.items[0].attributes.objectid,
        },
                  
        symbol: {
          type: "simple-line",
          color: '#8DB600',
          width: 10,
          style: "solid"
        }
      })
      rdbdAsset.graphics.add(pavement);
    }
    else if(y[d].srfcType === 'Gravel'){
      let getstart = (element) => element >= y[d].AssetBeginDfo;
      let endstart = (element) => element >= y[d].AssetEndDfo;
      console.log(mArr.findIndex(getstart))
      console.log(mArr.findIndex(endstart))
      let geom = densUpdate.slice(mArr.findIndex(getstart), mArr.findIndex(endstart)+1)
      console.log(geom)
      let gravel = new Graphic({
        geometry: {
          type: "polyline",
          paths: geom,
          hasM: true,
          spatialReference: {
            wkid: 3857
          }
        },
    
        attributes: {
          objectid: gLayer.graphics.items[0].attributes.objectid,
        },
                  
        symbol: {
          type: "simple-line",
          color: '#4B5320',
          width: 10,
          style: "solid"
        }
      })
      rdbdAsset.graphics.add(gravel);
    }
    else if(y[d].srfcType === 'Dirt/Natural'){
      let getstart = (element) => element >= y[d].AssetBeginDfo;
      let endstart = (element) => element >= y[d].AssetEndDfo;
      console.log(mArr.findIndex(getstart))
      console.log(mArr.findIndex(endstart))
      let geom = densUpdate.slice(mArr.findIndex(getstart), mArr.findIndex(endstart)+1)
      console.log(geom)
      let dirtNatural = new Graphic({
        geometry: {
          type: "polyline",
          paths: geom,
          hasM: true,
          spatialReference: {
            wkid: 3857
          }
        },
    
        attributes: {
          objectid: gLayer.graphics.items[0].attributes.objectid,
        },
                  
        symbol: {
          type: "simple-line",
          color: '#FFD12A',
          width: 10,
          style: "solid"
        }
      })
      rdbdAsset.graphics.add(dirtNatural);
    }
    else if(y[d].srfcType === 'Concrete'){
      let getstart = (element) => element >= y[d].AssetBeginDfo;
      let endstart = (element) => element >= y[d].AssetEndDfo;
      console.log(mArr.findIndex(getstart))
      console.log(mArr.findIndex(endstart))
      let geom = densUpdate.slice(mArr.findIndex(getstart), mArr.findIndex(endstart)+1)
      console.log(geom)
      let concrete = new Graphic({
        geometry: {
          type: "polyline",
          paths: geom,
          hasM: true,
          spatialReference: {
            wkid: 3857
          }
        },
    
        attributes: {
          objectid: gLayer.graphics.items[0].attributes.objectid,
        },
                  
        symbol: {
          type: "simple-line",
          color: '#000000',
          width: 10,
          style: "solid"
        }
      })
      rdbdAsset.graphics.add(concrete);
    }
    else if(y[d].srfcType === 'Brick'){
      let getstart = (element) => element >= y[d].AssetBeginDfo;
      let endstart = (element) => element >= y[d].AssetEndDfo;
      console.log(mArr.findIndex(getstart))
      console.log(mArr.findIndex(endstart))
      let geom = densUpdate.slice(mArr.findIndex(getstart), mArr.findIndex(endstart)+1)
      console.log(geom)
      let brick = new Graphic({
        geometry: {
          type: "polyline",
          paths: geom,
          hasM: true,
          spatialReference: {
            wkid: 3857
          }
        },
    
        attributes: {
          objectid: gLayer.graphics.items[0].attributes.objectid,
        },
                  
        symbol: {
          type: "simple-line",
          color: '#CC0000',
          width: 10,
          style: "solid"
        }
      })
      rdbdAsset.graphics.add(brick);
    }
  }
}
  
  
function newDfoMeasurement(y)
{
  console.log(y)
  sketch.on("update",function(event){
    if(event.state === "complete" && event.graphics[0].geometry.type === "point"){
      let objid;
      let pointA = new Graphic({
        geometry:{
          type: "point",
          longitude: event.graphics[0].geometry.x,
          latitude: event.graphics[0].geometry.y
        }
      })
      let webMercaPointA = webMercatorUtils.webMercatorToGeographic(pointA.geometry)
      for(let id in gLayer.graphics.items){
        if((gLayer.graphics.items[id].attributes.objectid === event.graphics[0].attributes.objectid) && gLayer.graphics.items[id].geometry.type === "polyline"){
          objid = gLayer.graphics.items[id].geometry
        }
      }
      let index = geometryEngine.nearestVertex(objid, pointA.geometry).vertexIndex
      console.log(typeof index, index+1)
      
      console.log(objid.paths[0])
      let path = objid.paths[0].slice(index, index+2)
      console.log(path)
      let pointB = new Graphic({
        geometry:{
          type: "point",
          longitude: path[0][0],
          latitude: path[0][1]
        }
      })
     
    
      let copyGeom = objid.paths[0]
      console.log(copyGeom)
      let arr = []
      for(let z=0; z < copyGeom.length; z++){
        console.log(copyGeom[z][2])
        arr.push(copyGeom[z][2])
      }
      console.log(arr)
      let webMercaPointB = webMercatorUtils.webMercatorToGeographic(pointB.geometry)
      const pointAPointB = geodesicUtils.geodesicDistance(webMercaPointA, webMercaPointB)
      console.log(pointAPointB)
      let newDfo = path[0][2] + (pointAPointB.distance/1609.344);
      let getdfoIndex = (element) => element >= path[0][2];
      let getChallengeIndex = arr.findIndex(getdfoIndex)
      console.log(getChallengeIndex)
      let indexPost = newDfo > path[0][2] ? getChallengeIndex +1 : getChallengeIndex-1
      console.log(indexPost)
      console.log(newDfo)
      console.log(path[0][2])
      
      let newGeom = objid.insertPoint(0,indexPost, [event.graphics[0].geometry.x, event.graphics[0].geometry.y, newDfo])
      createAssetGraph(newGeom, y)
    }
  })
}

export function getCoordsRange(y){
  console.log(y)
  let dens;
  console.log(gLayer)
  for(let id in gLayer.graphics.items){
    if(gLayer.graphics.items[id].attributes.objectid === y[0].objectid){
      console.log(gLayer.graphics.items[id])
      dens = gLayer.graphics.items[id].geometry
    }
  }
  let densUpdate = dens.paths[0];
  console.log(densUpdate)
  let mArr = [];
  if(mArr.length){
    mArr.length = 0
  }
  for(let i = 0; i < densUpdate.length; i++){
    //console.log(x[i][2])
    mArr.push(densUpdate[i][2]) //mval
  }
  // let startPoint = new Graphic({
  //   geometry: {
  //     type: "point",
  //     longitude: densUpdate[0][0],
  //     latitude: densUpdate[0][1]
  //   }
  // })

  // let endPoint = new Graphic({
  //   geometry: {
  //     type: "point",
  //     longitude: densUpdate[densUpdate.length - 1][0],
  //     latitude: densUpdate[densUpdate.length - 1][1]
  //   }
  // })  
  //let start = webMercatorUtils.webMercatorToGeographic(startPoint.geometry);
  //let end = webMercatorUtils.webMercatorToGeographic(endPoint.geometry);
  //view.graphics.add(criConstants.startPoint.geometry.longitude = start.x, criConstants.startPoint.geometry.latitude = start.y);
  //view.graphics.add(criConstants.endPoint.geometry.longitude = end.x, criConstants.endPoint.geometry.latitude = end.y);

  ////////////////////////Begin new Function///////////////////////////////////////////////////
  for(let d in y){
    console.log(y[d].srfcType)
    let getstart = (element) => element >= y[d].AssetBeginDfo;
    let endstart = (element) => element >= y[d].AssetEndDfo;
    console.log(mArr.findIndex(getstart))
    console.log(mArr.findIndex(endstart)-1)
    console.log(mArr.findIndex(endstart))
    let geom = densUpdate.slice(mArr.findIndex(endstart)-1,mArr.findIndex(endstart)+1)
    
    console.log(geom)
    const radius = (Math.abs(geom[0][2] - y[d].AssetEndDfo)) * 1609.344
    console.log(radius)
    const pointA =  new Graphic({
       geometry: {
          type: "point", 
          longitude: geom[0][0],
          latitude: geom[0][1]
        },
    })
    const pointB = new Graphic({
      geometry: {
        type: "point", 
        longitude: geom[1][0],
        latitude: geom[1][1]
      },
    })
    let a = webMercatorUtils.webMercatorToGeographic(pointA.geometry)
    let b = webMercatorUtils.webMercatorToGeographic(pointB.geometry)
          
    const findAzmith = geodesicUtils.geodesicDistance(a, b)
    const newDFO = geodesicUtils.pointFromDistance(a, radius,findAzmith.azimuth)
    console.log(newDFO.x, newDFO.y, y[d].srfcType)
    const geoToMerca = webMercatorUtils.geographicToWebMercator(newDFO)
////////////////////////End new Function///////////////////////////////////////////////////
    //console.log(dens.insertPoint(0,mArr.findIndex(endstart), [geoToMerca.x, geoToMerca.y, y[d].AssetEndDfo]))
    let assetType = y[d].srfcType
    let pointColor;
    switch(assetType){
      case "Paved":
        pointColor = "#5D8AA8"		
      break;
      case "Brick":
        pointColor = "#E32636"
      break;
      case "Dirt/Natural":
        pointColor = "#98777B"
      break;
      case "Gravel":
        pointColor = "#848482"
      break;
      case "Concrete":
        pointColor = "#000000"
    } 

    const assetSym = {
      type: "simple-marker",
      color: pointColor
    }
    console.log(geoToMerca)
    let assetPoint = new Graphic({
      geometry: {
        type: "point",
        hasM: true,
        longitude: newDFO.x,
        latitude: newDFO.y,
        spatialReference: {
          wkid: 3857
        }
      },
      attributes: {
        objectid: y[d].objectid,
        assetTyp: assetType
      },
      symbol: assetSym
    })

    rdbdAsset.graphics.add(assetPoint)
  }
  newDfoMeasurement(y);
}

// export async function getFeature(){
//   let getGraphPromise = new Promise(function(resp){
//       view.on("immediate-click", function(event){
//         let option = {include: featLayer}
      
//           view.when(function(){
//             view.hitTest(event,option)
//             .then(function(response){
//               if(response.results.length){
//                 let queryFeat = featLayer.queryFeatures({
//                   objectIds: [response.results[0].graphic.attributes.objectid],
//                   outFields: ["*"],
//                   returnGeometry: true,
//                   returnM: true
//                 })
//                 queryFeat.then(result => resp(result))
//               }
//             })
//           })
//       });
//   });
//   //create one function for query tables
//  let returnGetGraph = await getGraphPromise;
//  const query = new Query();
//   query.where = `RDBD_GMTRY_LN_ID = ${returnGetGraph.features[0].attributes.gid}`
//   query.outFields = [ "*" ]
//   const rdbdSrfc = rdbdSrfcAsst.queryFeatures(query)
//   const rdbdDsgn = rdbdDsgnAsst.queryFeatures(query)
//   const rdbdName = rdbdNameAsst.queryFeatures(query)
//   const rdbdLane = rdbdLaneAsst.queryFeatures(query)
//   const rdbdSrfcAtt = await rdbdSrfc
//   const rdbdDsgnAtt = await rdbdDsgn
//   const rdbdNameAtt = await rdbdName
//   const rdbdLaneAtt = await rdbdLane
//   console.log(rdbdSrfcAtt)
//   let rdbdSrfArry = [];
//   if(rdbdSrfArry.length){
//     rdbdSrfArry.length = 0
//   }
//   for(let srf in rdbdSrfcAtt.features){
//     console.log(rdbdSrfcAtt.features[srf])
//     let surface = criConstants.surface
//     for(let i in surface){
//       if(surface[i]['num'] === rdbdSrfcAtt.features[srf].attributes.srfc_type_id){
//         rdbdSrfcAtt.features[srf].attributes.srfc_type_id = surface[i]['name']
//       }
//     }
//     console.log(rdbdSrfcAtt.features[srf].attributes)
//     rdbdSrfArry.push(rdbdSrfcAtt.features[srf].attributes)
//   }
//   console.log(rdbdSrfArry)
//   rdbdSrfArry.sort((a,b)=>(a.asset_ln_begin_dfo_ms > b.asset_ln_begin_dfo_ms)? 1:-1)
//   roadInfo.getSurface = rdbdSrfArry
//   roadInfo.getDesign = rdbdDsgnAtt.features[0].attributes.rdway_dsgn_type_dscr
//   roadInfo.getName = rdbdNameAtt.features[0].attributes.st_defn_nm
//   roadInfo.getLane = rdbdLaneAtt.features[0].attributes.nbr_thru_lane_cnt
//   console.log(rdbdSrfcAtt.features[0].attributes)
//  return 1
// }

// export async function HoverAtt(){
//   view.on('pointer-move', (event) => {
//     const opts = {include: featLayer}
//     view.hitTest(event, opts).then(function(response){
//       if (response.results.length) {
//         let editFeature = response.results[0].graphic;
//         view.whenLayerView(editFeature.layer).then(function(layerView){
//          console.log(layerView)
//         })
//       }
//     })
//   })
  // console.log(hoverFeature)
  // const query = new Query();
  // query.where = `RDBD_GMTRY_LN_ID = ${hoverFeature.features[0].attributes.gid}`
  // query.outFields = [ "*" ]
  // const rdbdSrfc = rdbdSrfcAsst.queryFeatures(query)
  // const rdbdDsgn = rdbdDsgnAsst.queryFeatures(query)
  // const rdbdName = rdbdNameAsst.queryFeatures(query)
  // const rdbdLane = rdbdLaneAsst.queryFeatures(query)
  // const rdbdSrfcAtt = await rdbdSrfc
  // const rdbdDsgnAtt = await rdbdDsgn
  // const rdbdNameAtt = await rdbdName
  // const rdbdLaneAtt = await rdbdLane
  // console.log(rdbdSrfcAtt)
  // let rdbdSrfArry = [];
  // if(rdbdSrfArry.length){
  //   rdbdSrfArry.length = 0
  // }
  // for(let srf in rdbdSrfcAtt.features){
  //   console.log(rdbdSrfcAtt.features[srf])
  //   let surface = criConstants.surface
  //   for(let i in surface){
  //     if(surface[i]['num'] === rdbdSrfcAtt.features[srf].attributes.srfc_type_id){
  //       rdbdSrfcAtt.features[srf].attributes.srfc_type_id = surface[i]['name']
  //     }
  //   }
  //   console.log(rdbdSrfcAtt.features[srf].attributes)
  //   rdbdSrfArry.push(rdbdSrfcAtt.features[srf].attributes)
  // }
  // console.log(rdbdSrfArry)
  // rdbdSrfArry.sort((a,b)=>(a.asset_ln_begin_dfo_ms > b.asset_ln_begin_dfo_ms)? 1:-1)
  // roadInfo.getSurface = rdbdSrfArry
  // roadInfo.getDesign = rdbdDsgnAtt.features[0].attributes.rdway_dsgn_type_dscr
  // roadInfo.getName = rdbdNameAtt.features[0].attributes.st_defn_nm
  // roadInfo.getLane = rdbdLaneAtt.features[0].attributes.nbr_thru_lane_cnt
  // console.log(rdbdSrfcAtt.features[0].attributes)
//   return 1
// }

// export async function deleteGeom(){
//   let delPromise = new Promise(function(res){
//     view.on("click", (event) => {
//       let opts = { include: featLayer }
//       view.hitTest(event, opts).then(function(response){
//         for(let i=0; i < response.results.length; i++){
//           if(response.results[i].graphic.geometry !== null && response.results[i].graphic.sourceLayer !== null){
//             let queryFeat = featLayer.queryFeatures({
//               objectIds: [response.results[0].graphic.attributes.objectid],
//               outFields: ["*"],
//               returnGeometry: true,
//               returnM: true
//             })
//             queryFeat.then(result => res(result))
//           }
//         }
//       })
//     })
//   })

//   let retdelPromise = await delPromise
//   console.log(retdelPromise)
//   let newDelGraphic = new Graphic({
//     geometry: {
//       type: "polyline",
//       paths: retdelPromise.features[0].geometry.paths[0],
//       hasM: true,
//       spatialReference: {
//         wkid: 3857
//       }
//     },

//     attributes: {
//       objectid: retdelPromise.features[0].attributes.objectid
//     },
              
//     symbol: {
//       type: "simple-line",
//       color: [0, 0, 255],
//       width: 2,
//       style: "dash"
//     }
//   })
//   let delobjectidList = [];
//   delgLayer.graphics.add(newDelGraphic);
//   for(let id in delgLayer.graphics.items)
//     if(delgLayer.graphics.items[id].attributes !== null){
//       delobjectidList.push(delgLayer.graphics.items[id].attributes.objectid)
//     }
//     featLayer.definitionExpression = `OBJECTID not in (${delobjectidList}) and cnty_nm = '${roadInfo.getcntyName}'`
//     console.log(delgLayer)
// }

// export async function getM(){
//   let mPromise = new Promise(function(res){
//   view.on('click', function(evt){
//     let opts = {include: gLayer}
//     view.hitTest(evt, opts).then(function(response){
//       console.log(response)
//     })
//   })
//   })

// }
