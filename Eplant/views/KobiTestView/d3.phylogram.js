/*
  d3.phylogram.js
  Wrapper around a d3-based phylogram (tree where branch lengths are scaled)
  Also includes a radial dendrogram visualization (branch lengths not scaled)
  along with some helper methods for building angled-branch trees.

  Copyright (c) 2013, Ken-ichi Ueda

  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer. Redistributions in binary
  form must reproduce the above copyright notice, this list of conditions and
  the following disclaimer in the documentation and/or other materials
  provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE.

  DOCUEMENTATION

  d3.phylogram.build(selector, nodes, options)
    Creates a phylogram.
    Arguments:
      selector: selector of an element that will contain the SVG
      nodes: JS object of nodes (JSON)
    Options:
      width
        Width of the vis, will attempt to set a default based on the width of
        the container.
      height
        Height of the vis, will attempt to set a default based on the height
        of the container.
      vis
        Pre-constructed d3 vis.
      tree
        Pre-constructed d3 tree layout.
      children
        Function for retrieving an array of children given a node. Default is
        to assume each node has an attribute called "branchset"
      diagonal
        Function that creates the d attribute for an svg:path. Defaults to a
        right-angle diagonal.
      skipTicks
        Skip the tick rule. ticks: measurements in grey vertical lines
      skipBranchLengthScaling
        Make a dendrogram instead of a phylogram.

  d3.phylogram.buildRadial(selector, nodes, options)
    Creates a radial dendrogram.
    Options: same as build, but without diagonal, skipTicks, and
      skipBranchLengthScaling

  d3.phylogram.rightAngleDiagonal()
    Similar to d3.diagonal except it create an orthogonal crook instead of a
    smooth Bezier curve.

  d3.phylogram.radialRightAngleDiagonal()
    d3.phylogram.rightAngleDiagonal for radial layouts.
*/

import * as d3 from 'd3';

if (!d3) { throw "d3 wasn't included!"};
(function() {
  
  d3.phylogram.rightAngleDiagonal = function() {
    var projection = function(d) { return [d.y, d.x]; }

    var path = function(pathData) {
      return "M" + pathData[0] + ' ' + pathData[1] + " " + pathData[2];
    }

    function diagonal(diagonalPath, i) {
      var source = diagonalPath.source,
          target = diagonalPath.target,
          midpointX = (source.x + target.x) / 2,
          midpointY = (source.y + target.y) / 2,
          pathData = [source, {x: target.x, y: source.y}, target];
      pathData = pathData.map(projection);
      return path(pathData)
    }

    diagonal.projection = function(x) {
      if (!arguments.length) return projection;
      projection = x;
      return diagonal;
    };

    diagonal.path = function(x) {
      if (!arguments.length) return path;
      path = x;
      return diagonal;
    };

    return diagonal;
  }

  // Convert XY and radius to angle of a circle centered at 0,0
  d3.phylogram.coordinateToAngle = function(coord, radius) {
    var wholeAngle = 2 * Math.PI,
        quarterAngle = wholeAngle / 4

    var coordQuad = coord[0] >= 0 ? (coord[1] >= 0 ? 1 : 2) : (coord[1] >= 0 ? 4 : 3),
        coordBaseAngle = Math.abs(Math.asin(coord[1] / radius))

    let coordAngle;

    // Since this is just based on the angle of the right triangle formed
    // by the coordinate and the origin, each quad will have different
    // offsets
    switch (coordQuad) {
      
      case 1:
        coordAngle = quarterAngle - coordBaseAngle
        break
      case 2:
        coordAngle = quarterAngle + coordBaseAngle
        break
      case 3:
        coordAngle = 2*quarterAngle + quarterAngle - coordBaseAngle
        break
      case 4:
        coordAngle = 3*quarterAngle + coordBaseAngle
    }
    return coordAngle
  }

  d3.phylogram.styleTreeNodes = function(vis) {
    vis.selectAll('g.leaf.node')
      .append("svg:circle")
        .attr("r", 4.5)
        .attr('fill', '#99cc00') //BEN CHANGED (removed stroke and changed color of fill)
        .attr('stroke-width', '2px');

    vis.selectAll('g.root.node')
      .append('svg:circle')
        .attr("r", 4.5)
        .attr('fill', 'steelblue')
        .attr('stroke', '#369')
        .attr('stroke-width', '2px');

  }

  function scaleBranchLengths(nodes, w) {
    // Visit all nodes and adjust y pos width distance metric
    var visitPreOrder = function(root, callback) {
      callback(root)
      if (root.children) {
        for (var i = root.children.length - 1; i >= 0; i--){
          visitPreOrder(root.children[i], callback)
        };
      }
    }
    visitPreOrder(nodes[0], function(node) {
      node.rootDist = (node.parent ? node.parent.rootDist : 0) + (node.length || 0)
    })
    var rootDists = nodes.map(function(n) { return n.rootDist; });
    var yscale = d3.scale.linear()
      .domain([0, d3.max(rootDists)])
      .range([0, w]);
    visitPreOrder(nodes[0], function(node) {
      node.y = yscale(node.rootDist)
    })
    return yscale
  }

 // phylogram build function
 d3.phylogram.build = function(selector, nodes, q, eFPLinks, gens, scc, seq, options) {
    options = options || {}
    var w = options.width || d3.select(selector).style('width') || d3.select(selector).attr('width'),
        h = options.height || d3.select(selector).style('height') || d3.select(selector).attr('height')
    w = parseInt(w),
    h = parseInt(h);
    var tree = options.tree || d3.layout.cluster()
      .size([h, w])
      .sort(function(node) { return node.children ? node.children.length : -1; })
      .children(options.children || function(node) {
        return node.branchset
      });
    var diagonal = options.diagonal || d3.phylogram.rightAngleDiagonal();
    var vis = options.vis || d3.select(selector).append("svg:svg")
        .attr("width", w + 1000) // to change width/height of container
        .attr("height", h + 50)
      .append("svg:g")
        .attr("transform", "translate(20, 20)");
    nodes = tree(nodes);
    //var eFPLinks = eFPLinks;
    var genomes = gens;
    var sccValues = scc;
    var seqValues = seq;
    var query = q;


    //hidden until made visible by being active
    d3.select(selector).style("visibility", "hidden");

    if (!options.skipBranchLengthScaling) {
      var yscale = d3.scale.linear()
        .domain([0, w])
        .range([0, w]);
    }

    var link = vis.selectAll("path.link")
        .data(tree.links(nodes))
      .enter().append("svg:path")
        .attr("class", "link")
        .attr("d", diagonal)
        .attr("fill", "none")
        .attr("stroke", "#aaa")
        .attr("stroke-width", "4px");

    var node = vis.selectAll("g.node")
        .data(nodes)
      .enter().append("svg:g")
        .attr("class", function(n) {
          if (n.children) {
            if (n.depth == 0) {
              return "root node"
            } else {
              return "inner node"
            }
          } else {
            return "leaf node"
          }
        })
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })

    d3.phylogram.styleTreeNodes(vis)

    if (!options.skipLabels) {
      nodes = vis.selectAll('g.inner.node')
        .append("svg:text")
        .attr("dx", -6)
        .attr("dy", -6)
        .attr("text-anchor", 'end') 
        .attr('font-size', '8px')
        .attr('fill', '#ccc')
        .text(function(d) { return d.length; });

     var leafNode = vis.selectAll('g.leaf.node');

     var showAll = vis.select("#button")
     	.append("svg:svg")

// 		.on({
// 		      "mouseover": function(d) {
// 		        d3.select(this).style("cursor", "auto")
// //		        species.filter(function(p){
// //		        	if(p == d)
// //		        		d3.select(this)
// //		        		.style("cursor", "default")
// //		        		.style("visibility", "visible")
// //		        		.transition()
// //		        		.style("opacity", 1);
// //
// //		        	else d3.select(this)
// //		        		.transition()
// //		        		.style("opacity", 0);
// //		        })
// 		        icons.filter(function(p){
// 		        	if(p == d)
// 		        		d3.select(this)
// 		        		.style("visibility", "visible")
// 		        		.transition()
// 		        		.style("opacity", 1);
//
// 		        	else d3.select(this)
// 		        		.transition()
// 		        		.style("opacity", 0);
// 		        });
// 		      },
// 		      "mouseout": function(d) {
// 		        d3.select(this).style("cursor", "default")
// 		      }
// 		    });
     var first = true;
//      d3.select("#button")
//       	.on("click", function() {
//       		if (icons.style("visibility") == "visible") {
//       			d3.select(this).text("show all");
//       			icons.style("visibility", "visible") //hidden
// //      			species.style("visibility", "hidden")
//       			hover = leafNode
//       			.on({
//       		      "mouseover": function(d) {
//       		        d3.select(this).style("cursor", "pointer")
// //      		        species.filter(function(p){
// //      		        	if(p == d)
// //      		        		d3.select(this)
// //      		        		.style("cursor", "default")
// //      		        		.style("visibility", "visible")
// //      		        		.transition()
// //      		        		.style("opacity", 1);
// //
// //      		        	else d3.select(this)
// //      		        		.transition()
// //      		        		.style("opacity", 0);
// //      		        })
//       		        icons.filter(function(p){
//       		        	if(p == d)
//       		        		d3.select(this)
//       		        		.style("visibility", "visible")
//       		        		.transition()
//       		        		.style("opacity", 1);
//
//       		        	else d3.select(this)
//       		        		.transition()
//       		        		.style("opacity", 0);
//       		        });
//       		      },
//       		      "mouseout": function(d) {
//       		        d3.select(this).style("cursor", "default")
//       		      }
//       		    });
//
//
//       		}
//       		else if (icons.style("visibility") == "hidden") {
//       			d3.select(this).text("hide all");
//       			icons.style("visibility", "visible")
//
//       			.style("opacity", 1)
// //      			species.style("visibility", "visible")
// //      			.style("opacity", 1);
//       			hover.on("mouseover", null);
//       			hover.on("mouseout",null);
//
//
//       		}
//       	});

      var label = leafNode.append("svg:text")
        .attr("dx", 8)
        .attr("dy", 4)
        .attr("text-anchor", "start")
        .attr('font-family', 'Helvetica Neue, Helvetica, sans-serif')
        .attr('font-size', '15px')
        .attr('fill', 'black')
        .style("font-weight", function(d) {
					if (d.name === query) {
						return "bold"
					}
        		})

        .text(function(d) { return d.name}); //+ ' ('+ d.length +')'


      // vars for concatenation
      var titleData = ["World", "Plant", "Cell", "Molecule", "Interactions"];
      var generalURL = "http://bar.utoronto.ca/eplant/?ActiveSpecies=Arabidopsis%20thaliana&Genes=";
      var cogeURL = "https://genomevolution.org/CoGe/GEvo.pl?accn1=";
      var grameneURL = "http://ensembl.gramene.org/Arabidopsis_thaliana/Gene/Summary?g=";


      var species = leafNode.append("svg:text")
	      .attr("dx", 300)
	      .attr("dy", 3)
	      .attr("text-anchor", "end")
	      .attr('font-family', 'Helvetica Neue, Helvetica, sans-serif')
	      .attr('font-size', '14px')
	      .style("font-weight", "bold")
	      .attr('fill', function(d) {
	    	  if (genomes[d.name] == "GRAPE") {
	    		  return "gray";
	    	  }
	    	  else if (genomes[d.name] == "POP") {
	    		  return "gray";
	    	  }
	    	  else if (genomes[d.name] == "MED") {
	    		  return "red";
	    	  }
	    	  else if (genomes[d.name] == "SOYBEAN") {
	    		  return "cornflowerblue";
	    	  }
	    	  else if (genomes[d.name] == "POTATO") {
	    		  return "darkolivegreen";
	    	  }
	    	  else if (genomes[d.name] == "TOMATO") {
	    		  return "orange";
	    	  }
	    	  else if (genomes[d.name] == "RICE") {
	    		  return "green";
	    	  }
	    	  else if (genomes[d.name] == "MAIZE") {
	    		  return "turquoise";
	    	  }
	    	  else if (genomes[d.name] == "BARLEY") {
	    		  return "gold";
	    	  }
          else if (genomes[d.name] == "ARABIDOPSIS") {
	    		  return "black";
	    	  }
	    	  else {
	    		  return "black";
	    	  }
	      })

	      .text(function(d) {

          if (d.name.substr(0,2) == "AT") {
              return "ARABIDOPSIS";
          }
          else {
	    		  return genomes[d.name];
	    	  }
	    	  });

      var icons = leafNode.append("svg")
      	.attr("x", 320)
      	.attr("y", -11)
      	.attr("align", "right");

      var seqTip = d3.tip()
      	.attr('class', 'd3-tip')
      	.style("font-size", "13px")
      	.style("margin-top", "0px")
        .style("background-color", "yellowgreen")
        .style("color", "white")
      	.offset([-10, 0])
      	.html(function(d) {
      		if (d.name != query) {
      			return "<strong>&nbsp;&nbsp;Sequence similarity:</strong> <span style='color:white'>" + seqValues[d.name] + "&nbsp;&nbsp;</span>";
      		}
      		else {
      			return "<strong>&nbsp;&nbsp;Sequence similarity:</strong> <span style='color:white'>" + 100 + "&nbsp;&nbsp;</span>";
      		}

      	});

      icons.call(seqTip);

      seq = leafNode.append("svg:g")
      	.on('mouseover', seqTip.show)
        .on('mouseout', seqTip.hide);


      var seqBarsWhole = seq.append("rect")
        .attr("x", 325)
        .attr("y", -7)
        .attr("width", 50)
        .attr("height", 10)
        .attr("fill", "gray");


      var seqBars = seq.append("rect")
        .attr("x", 325)
        .attr("y", -7)
        .attr("fill", "black")
        .attr("width", function(d) {
        	if (d.name != query) {
        		return (seqValues[d.name])/2;
        	}
        	else {
        		return 50;
        	}

        	})
        .attr("height", 10);


      var titleSeq = vis.append("svg:text")
      	.attr("dx", 480)
      	.attr("dy", 0) //BEN CHANGED 9 => 0
      	.attr("text-anchor", "start")
        .attr('font-family', 'Helvetica Neue, Helvetica, sans-serif')
        .attr('font-size', '11px')
        .attr('fill', 'black')
        .text("SEQUENCE");

      var titleScc = vis.append("svg:text")
  		.attr("dx", 552)
  		.attr("dy", 0) //BEN CHANGED 9 => 0
  		.attr("text-anchor", "start")
	    .attr('font-family', 'Helvetica Neue, Helvetica, sans-serif')
	    .attr('font-size', '11px')
	    .attr('fill', 'black')
	    .text("EXPRESSION");


      var sccTip = d3.tip()
    	.attr('class', 'd3-tip')
    	.style("font-size", "13px")
      .style("margin-top", "0px")
      .style("background-color", "yellowgreen")
      .style("color", "white")
    	.offset([-10, 0])
    	.html(function(d) {
    		if (d.name != query) {
    			return "<strong>&nbsp;&nbsp;Expression similarity:</strong> <span style='color:white'>" + sccValues[d.name] + "&nbsp;&nbsp;</span>";
    		}
    		else {
    			return "<strong>&nbsp;&nbsp;Expression similarity:</strong> <span style='color:white'>" + 1 + "&nbsp;&nbsp;</span>";
    		}
    	});

      icons.call(sccTip);

      scc = leafNode.append("svg:g")
      	.on('mouseover', sccTip.show)
        .on('mouseout', sccTip.hide);

      var sccBarsWhole = scc.append("rect")
        .attr("x", 402)
        .attr("y", -7)
        .attr("width", 52)
        .attr("height", 10)
        .attr("fill", "gray");

      var sccDivider = scc.append("rect")
      	.attr("x", 428)
      	.attr("y", -12)
      	.attr("width", 1)
        .attr("height", 20)
        .attr("fill", "red");

      var negSccBars = scc.append("rect")
        .attr("fill", function(d) { // if negative, lighter colour
        		if (sccValues[d.name] < 0) {
        			return "darkslategray";
        		}
        		else {
        			return "black";
        		}
        	})
        .attr("width", function(d) {
                  if (sccValues[d.name] < 0) { // negative value
                	  return Math.abs(sccValues[d.name]) * 25;
                  }
                  else if (sccValues[d.name] > 0) {
                	  return sccValues[d.name] * 25;
                  }
                  else if (d.name == query) {
                	return 27;
                  }
                  else {
                    return 0;
                  }
              })
        .attr("x", function(d) {
	        	if (sccValues[d.name] < 0) { // negative value
	          	  	return 428 - Math.abs(sccValues[d.name]) * 25;
	            }
	            else if (sccValues[d.name] > 0) {
	          	  	return 429;
	            }
	            else if (d.name == query) {
	            	return 429;
	            }
	            else {
	            	return 0;
	            }
        	})
        .attr("y", -7)
        .attr("height", 10);


      var worldTip = d3.tip()
	  	.attr('class', 'd3-tip')
	  	.style("font-size", "13px")
      .style("margin-top", "0px")
      .style("background-color", "yellowgreen")
      .style("color", "white")
	  	.offset([-10, 0])
	  	.html(function(d) {
	  		if (d.name.substr(0,2) != "AT") {return "&nbsp;&nbsp;Coming soon!&nbsp;&nbsp;";}
		    else {return "&nbsp;&nbsp;" + titleData[0] + "&nbsp;&nbsp;";};
	  	});

      icons.call(worldTip);

      var worldEFP = icons.append("a")
    	.attr("xlink:href", function(d) {
    			return generalURL + d.name + "&ActiveGene=" + d.name + "&ActiveView=" + "WorldView";
    		})
        .attr("target", "_blank")
      	.append("image")
      	.attr("xlink:href",  function(d) {return 'img/available/world.png';})

      	.attr("x", 150)
      	.attr("y", 0)
      	.attr("height", 20)
      	.attr("width", 20)
      	.style("opacity", function (d) {
      		// for non-arabidopsis, gray out all icons but plant
      		if (d.name.substr(0,2) != "AT") {return "0.2";}

      	})
      	.on('mouseover', worldTip.show)
        .on('mouseout', worldTip.hide);



      var plantTip = d3.tip()
	  	.attr('class', 'd3-tip')
	  	.style("font-size", "13px")
      .style("margin-top", "0px")
      .style("background-color", "yellowgreen")
      .style("color", "white")
	  	.offset([-10, 0])
	  	.html("&nbsp;&nbsp;" + titleData[1] + "&nbsp;&nbsp;");

      icons.call(plantTip);

      var plantEFP = icons.append("a")
    		.attr("xlink:href", function(d) {
    			if (d.name.substr(0,2) != "AT") {
    				return eFPLinks[d.name];
    			}
    			else {
    				return generalURL + d.name + "&ActiveGene=" + d.name + "&ActiveView=" + "PlantView";
    			}

        	})
          .attr("target", "_blank")
      		.append("image")
          	.attr("xlink:href",  function(d) { return 'img/available/plant.png';})
          	.attr("x", 185)
          	.attr("y", 0)
          	.attr("height", 20)
          	.attr("width", 20)
          	.on('mouseover', plantTip.show)
          	.on('mouseout', plantTip.hide);

      var cellTip = d3.tip()
	  	.attr('class', 'd3-tip')
	  	.style("font-size", "13px")
      .style("margin-top", "0px")
      .style("background-color", "yellowgreen")
      .style("color", "white")
	  	.offset([-10, 0])
	  	.html(function (d) {
    		// for non-arabidopsis, say that it's coming soon
    		if (d.name.substr(0,2) != "AT") {return "&nbsp;&nbsp;Coming soon!&nbsp;&nbsp;";}
    		else {return "&nbsp;&nbsp;" + titleData[2] + "&nbsp;&nbsp;";}
	  	});

      icons.call(cellTip);

      var cellEFP = icons.append("a")
  		.attr("xlink:href", function(d) {
    			return generalURL + d.name + "&ActiveGene=" + d.name + "&ActiveView=" + "CellView";
    		})
        .attr("target", "_blank")
  		.append("svg:image")
    	.attr("xlink:href",  function(d) { return 'img/available/cell.png';})
    	.attr("x", 220)
    	.attr("y", 0)
    	.attr("height", 20)
    	.attr("width", 20)
    	.style("opacity", function (d) {
      		// for non-arabidopsis, gray out all icons but plant
      		if (d.name.substr(0,2) != "AT") {return "0.2";}
      	})
      	.on('mouseover', cellTip.show)
        .on('mouseout', cellTip.hide);

      var molTip = d3.tip()
	  	.attr('class', 'd3-tip')
	  	.style("font-size", "13px")
      .style("margin-top", "0px")
      .style("background-color", "yellowgreen")
      .style("color", "white")
	  	.offset([-10, 0])
	  	.html(function (d) {
	  		// for non-arabidopsis, say that it's coming soon
	  		if (d.name.substr(0,2) != "AT") {return "&nbsp;&nbsp;Coming soon!&nbsp;&nbsp;";}
	  		else {return "&nbsp;&nbsp;" + titleData[3] + "&nbsp;&nbsp;";}
	  	});

      icons.call(molTip);

      var moleculeviewer = icons.append("a")
  		.attr("xlink:href", function(d) {
    			return generalURL + d.name + "&ActiveGene=" + d.name + "&ActiveView=" + "MoleculeView";
    		})
        .attr("target", "_blank")
  		.append("svg:image")
    	.attr("xlink:href",  function(d) { return 'img/available/molecule.png';})
    	.attr("x", 255)
    	.attr("y", 0)
    	.attr("height", 20)
    	.attr("width", 20)
    	.style("opacity", function (d) {
      		// for non-arabidopsis, gray out all icons but plant
      		if (d.name.substr(0,2) != "AT") {return "0.2";}
      	})
    	.on('mouseover', molTip.show)
        .on('mouseout', molTip.hide);


      var intTip = d3.tip()
	  	.attr('class', 'd3-tip')
	  	.style("font-size", "13px")
      .style("margin-top", "0px")
      .style("background-color", "yellowgreen")
      .style("color", "white")
	  	.offset([-10, 0])
	  	.html(function (d) {
	  		// for non-arabidopsis, say that it's coming soon
	  		if (d.name.substr(0,2) != "AT") {return "&nbsp;&nbsp;Coming soon!&nbsp;&nbsp;";}
	  		else {return "&nbsp;&nbsp;" + titleData[4] + "&nbsp;&nbsp;";}
	  	});

      icons.call(intTip);

      var interactionviewer = icons.append("a")
  		.attr("xlink:href", function(d) {
    			return generalURL + d.name + "&ActiveGene=" + d.name + "&ActiveView=" + "InteractionView";
    		})
        .attr("target", "_blank")
  		.append("svg:image")
    	.attr("xlink:href",  function(d) { return 'img/available/interaction.png';})
    	.attr("x", 290)
    	.attr("y", 0)
    	.attr("height", 20)
    	.attr("width", 20)
    	.style("opacity", function (d) {
      		// for non-arabidopsis, gray out all icons but plant
      		if (d.name.substr(0,2) != "AT") {return "0.2";}
      	})
      	.on('mouseover', intTip.show)
        .on('mouseout', intTip.hide);

    	}

    var coge = icons.append("a")
		.attr("xlink:href", function(d) {
				if (d.name != query)
    			{
    				return cogeURL + query + ";accn2=" + d.name + ";num_seqs=2;autogo=1";
    			}
    		})
        .attr("target", "_blank")
		.append("svg:text")
		.attr("dx", 327)
		.attr("dy", 18)
		.attr("height", 20)
		.attr("width", 20)
		.style("font-size","12px")
		.style("visibility", function (d) {
      		// for non-arabidopsis, gray out all icons but plant
      		if (d.name === query) {return "hidden";}
      	})
	  	.text("CoGE");

    var gramene = icons.append("a")
		.attr("xlink:href", function(d) {
				if (d.name != query)
    			{
    				return grameneURL + d.name;
    			}
    		})
        .attr("target", "_blank")
		.append("svg:text")
		.attr("dx", 368)
		.attr("dy", 18)
		.attr("height", 20)
		.attr("width", 20)
		.style("font-size","12px")
		.style("visibility", function (d) {
      		// for non-arabidopsis, gray out all icons but plant
      		if (d.name === query) {return "hidden";}
      	})
	  	.text("Gramene");
    return {tree: tree, vis: vis}
 }

}());
