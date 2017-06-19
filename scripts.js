// TODO
// Optimize Code: 
// Make findMaxY not iterate thru all values to determine max
// Do not require full path renderings of all the lines and then clip them in order to show the graph

/* global d3 */

//var margin = {top: 20, right: 200, bottom: 100, left: 50},
    //margin2 = { top: 430, right: 10, bottom: 20, left: 40 },
    //width = 700 - margin.left - margin.right,
    //height = 500 - margin.top - margin.bottom,
    //height2 = 500 - margin2.top - margin2.bottom,

  var svg_margin = {top: 0, bottom: 0, right: 0, left: 20},
      
      chart_margin = {top: 0, bottom: 0, right: 0, left: 160},
      chart_width = 600,
      
      scrubber_margin = { top: 20, bottom: 0, right: 0, left: 0},
      scrubber_height = 30,
      scrubber_container = { height: scrubber_height + scrubber_margin.top + scrubber_margin.bottom, y: chart_margin.top},
      
      graph_margin = {top: 20, bottom: 20, right: 0, left: 0},
      graph_height = 400,
      graph_container = { y: chart_margin.top + scrubber_container.height, height: graph_height + graph_margin.top + graph_margin.bottom },
      
      timeline_margin = {top: 20, bottom: 20, right: 0, left: 0},
      timeline_row_height = 20,
      timeline_height = timeline_row_height * 6, // replace 6 with calculated number of timeline rows
      timeline_container = { y: graph_container.y+graph_container.height, height: timeline_height + timeline_margin.top + timeline_margin.bottom },
        
    
    chart_container_height = scrubber_container.height + graph_container.height + timeline_container.height;


var parseDate = d3.time.format("%m/%d/%Y").parse;
var bisectDate = d3.bisector(function(d) { return d.date; }).left;

var xScale = d3.time.scale()
    .range([0, chart_width]),

    scrubberxScale = d3.time.scale()
    .range([0, chart_width]); // Duplicate xScale for brushing ref later

var yScale = d3.scale.linear()
    .range([graph_height, 0]);

// 40 Custom DDV colors 
//var color = d3.scale.ordinal().range(["#48A36D",  "#56AE7C",  "#64B98C", "#72C39B", "#80CEAA", "#80CCB3", "#7FC9BD", "#7FC7C6", "#7EC4CF", "#7FBBCF", "#7FB1CF", "#80A8CE", "#809ECE", "#8897CE", "#8F90CD", "#9788CD", "#9E81CC", "#AA81C5", "#B681BE", "#C280B7", "#CE80B0", "#D3779F", "#D76D8F", "#DC647E", "#E05A6D", "#E16167", "#E26962", "#E2705C", "#E37756", "#E38457", "#E39158", "#E29D58", "#E2AA59", "#E0B15B", "#DFB95C", "#DDC05E", "#DBC75F", "#E3CF6D", "#EAD67C", "#F2DE8A"]);  
var color = d3.scale.category10();


// GRIDLINES

function make_x_gridlines() {        
    return d3.svg.axis()
        .scale(xScale)
         .orient("bottom")
         .ticks(10)
         .tickSize(-graph_height, 0, 0)
         .tickFormat("");
}

function make_y_gridlines() {        
    return d3.svg.axis()
        .scale(yScale)
        .orient("left")
        .ticks(10)
        .tickSize(-chart_width, 0, 0)
        .tickFormat("");
}


/// AXES 
var xAxis = d3.svg.axis()
    .scale(xScale)
    .orient("bottom"),

    scrubberxAxis = d3.svg.axis() // xAxis for brush slider
    .scale(scrubberxScale)
    .orient("top")
    .tickSize(0, 0, 0);

    scrubberxGridlines = d3.svg.axis()
    .scale(scrubberxScale)
    .tickFormat("")
    .ticks(10)
    .tickSize(scrubber_height, 0, 0);

var yAxis = d3.svg.axis()
    .scale(yScale)
    .orient("left");  

var line = d3.svg.line()
    .interpolate("basis")
    .x(function(d) { return xScale(d.date); })
    .y(function(d) { return yScale(d.rating); })
    .defined(function(d) { return d.rating; });  // Hiding line value defaults of 0 for missing data


var maxY; // Defined later to update yAxis

var svg = d3.select("body").append("svg")
    .attr("width", chart_width + chart_margin.left + chart_margin.right)
    .attr("height", chart_container_height)
  //.append("g")
    //.attr("transform", "translate(" + svg_margin.left + "," + svg_margin.top + ")");

// Create invisible rect for mouse tracking
svg.append("rect")
    .attr("width", chart_width)
    .attr("height", graph_height)                                    
    .attr("x", chart_margin.left) 
    .attr("y", graph_container.y + graph_margin.top)
    .attr("id", "mouse-tracker")
    .style("fill", "white");
    //.style("opacity",.5);
    
    

// SCRUBBER
var context = svg.append("g") // Brushing context box container
    .attr("transform", "translate(" + chart_margin.left + "," + scrubber_container.y + ")") // todo scrubber.x scrubber.y
    .attr("class", "context");

//append clip path for lines plotted, hiding those part out of bounds
svg.append("defs") //todo probably assumes xy of 00 but we do need to place it with the graph
  .append("clipPath") 
    .attr("id", "clip")
    .append("rect")
    .attr("width", chart_width)
    .attr("height", graph_height); 


d3.tsv("health_data.tsv", function(error, data) { 
  color.domain(d3.keys(data[0]).filter(function(key) { // Set the domain of the color ordinal scale to be all the csv headers except "date", matching a color to an issue
    return key !== "date"; 
  }));

  data.forEach(function(d) { // Make every date in the csv data a javascript date object format
    d.date = parseDate(d.date);
  });

  var categories = color.domain().map(function(name) { // Nest the data into an array of objects with new keys

    return {
      name: name, // "name": the csv headers except date
      values: data.map(function(d) { // "values": which has an array of the dates and ratings
        return {
          date: d.date, 
          rating: +(d[name]),
          };
      }),
      visible: (name === "Steps" || name === "Calories" || name === "Depression" || name === "Sleep Hours" || name === "Sleep Disturbance" || name === "Disease Activity"  ? false : true) // "visible": all false except for economy which is true.
    };
  });

  xScale.domain(d3.extent(data, function(d) { return d.date; })); // extent = highest and lowest points, domain is data, range is bouding box

  yScale.domain([0, d3.max(categories.filter( function(c) { return c.visible }), function(c) { return d3.max(c.values, function(v) { return v.rating; }); })
  ]);

  scrubberxScale.domain(xScale.domain()); // Setting a duplicate xdomain for brushing reference later
 
 
 // DRAW GRIDLINES

  svg.append("g")         
      .attr("class", "grid")
      .attr("id","x-gridlines")
      .attr("transform", "translate("+eval(chart_margin.left+graph_margin.left)+"," + eval(graph_container.y+graph_margin.top+graph_height) + ")")
      .call(make_x_gridlines());
  svg.append("g")         
      .attr("class", "grid")
      .attr("id","y-gridlines")
      .attr("transform", "translate("+eval(chart_margin.left+graph_margin.left)+"," + eval(graph_container.y+graph_margin.top) + ")")
      .call(make_y_gridlines());
 
 
 
//SCRUBBER

 var brush = d3.svg.brush()//for slider bar at the bottom
    .x(scrubberxScale)
    .on("brushend", brushend)
    .on("brushstart", brushstart);

  var contextArea = d3.svg.area() // Set attributes for area chart in brushing context graph
    .interpolate("monotone")
    .x(function(d) { return scrubberxScale(d.date); }) // x is scaled to scrubberxScale
    .y0(scrubber_container.y + scrubber_margin.top + scrubber_height) // Bottom line begins at height2 (area chart not inverted) 
    .y1(scrubber_container.y + scrubber_margin.top); // Top line of area, 0 (area chart not inverted)

  //plot the rect as the bar at the bottom
  context.append("path") // Path is created using svg.area details
    .attr("class", "area")
    .attr("fill", "#DDD")
    .attr("d", contextArea(categories[0].values)) // pass first categories data .values to area path generator 
    //.attr("fill", "#F1F1F2");


  context.append("rect")
    .attr("fill","darkgrey")
    .attr("height", scrubber_height*2/3) // Make brush rects same height 
    .attr("width", chart_width)
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/6));
      //.attr("fill", "#E6E7E8"); 

  context.append("g") // Create scrubber x Gridlines
      .attr("class", "scrubber-grid")
      .attr("transform", "translate(0," + eval(scrubber_container.y + scrubber_margin.top) + ")")
      .call(scrubberxGridlines);

  context.append("g") // Create scrubber xAxis
      .attr("class", "x axis1")
      //.attr("fill", "gray")
      .attr("transform", "translate(0," + eval(scrubber_container.y + scrubber_margin.top ) + ")")
      .call(scrubberxAxis);

  context.append("rect")
    .attr("class", "brush")
    .attr("id","fake-brush")
    .attr("fill","none")
    .attr("height", scrubber_height*2/3) // Make brush rects same height 
    .attr("width", chart_width)
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/6));
      //.attr("fill", "#E6E7E8"); 



  //append the brush for the selection of subsection  
  context.append("g")
    .attr("class", "x brush")
    .call(brush)
    .selectAll("rect")
    .attr("height", scrubber_height*2/3) // Make brush rects same height 
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/6));
      //.attr("fill", "#E6E7E8"); 



// LINE GRAPH
  
  //svg.append("g").attr("transform", "translate(" + chart_margin.left + "," + graph_container.y + ")")



  svg.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate("+eval(chart_margin.left+chart_width)+", "+eval(graph_container.y+graph_margin.top)+")")
      .call(yAxis)


  var issue = svg.selectAll(".issue")
      .data(categories) // Select nested data and append to new svg group elements
    .enter().append("g")
      .attr("class", "issue");   

  issue.append("path")
      .attr("class", "line")
      .style("pointer-events", "none") // Stop line interferring with cursor
      .attr("id", function(d) {
        return "line-" + d.name.replace(" ", "").replace("/", ""); // Give line id of line-(insert issue name, with any spaces replaced with no spaces)
      })
      .attr("d", function(d) { 
        return d.visible ? line(d.values) : null; // If array key "visible" = true then draw line, if not then don't 
      })
      .attr("transform", "translate("+chart_margin.left+", "+eval(graph_container.y+graph_margin.top)+")")
      .attr("clip-path", "url(#clip)")//use clip path to make irrelevant part invisible
      .style("stroke", function(d) { return color(d.name); });

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate("+chart_margin.left+","+eval(graph_container.y+graph_margin.top + graph_height)+")")
      .call(xAxis);



  //TIMELINE

  svg.append("g")
      .attr("transform", "translate("+chart_margin.left+","+eval(timeline_container.y + timeline_margin.top)+")")
      .append("rect")
        .attr("width", 10)
        .attr("height", 10)    
        .attr("fill", "black")
        .attr("transform", "translate("+chart_margin.left+","+eval(timeline_container.y + timeline_margin.top)+")");







      
// LEGEND
  var legendSpace = graph_height / categories.length; // 450 (just changed to height)/number of issues (ex. 40)    

  issue.append("rect")
      .attr("width", 10)
      .attr("height", 10)                                    
      .attr("x", 0) 
      .attr("y", function (d, i) { return graph_container.y + graph_margin.top + (legendSpace)+i*(legendSpace) - 8; })  // spacing
      .attr("fill",function(d) { return color(d.name) }) // If array key "visible" = true then color rect, if not then make it grey  //return d.visible ? color(d.name) : "#F1F1F2"; // If array key "visible" = true then color rect, if not then make it grey 
      .attr("stroke", function(d) { return d.visible ? "#000" : "#F1F1F2"; })
      .attr("class", "legend-box")

      .on("click", function(d){ // On click toggle d.visible 
        d.visible = !d.visible; // If array key for this data selection is "visible" = true then make it false, if false then make it true

        maxY = findMaxY(categories); // Find max Y rating value categories data with "visible"; true
        yScale.domain([0,maxY]); // Redefine yAxis domain based on highest y value of categories data with "visible"; true
        svg.select(".y.axis")
          .transition()
          .call(yAxis);   

        issue.select("path")
          .transition()
          .attr("d", function(d){
            return d.visible ? line(d.values) : null; // If d.visible is true then draw line for this d selection
          })

        issue.select("rect")
          .transition()
          .attr("stroke", function(d) {
          return d.visible ? "#000" : "#F1F1F2";
        });
      })

      .on("mouseover", function(d){

        d3.select(this)
          .transition()

        d3.select("#line-" + d.name.replace(" ", "").replace("/", ""))
          .transition()
          .style("stroke-width", 2.5);  
      })

      .on("mouseout", function(d){

        d3.select(this)
          .transition()
          .attr("stroke", function(d) { return d.visible ? "#000" : "#F1F1F2";});

        d3.select("#line-" + d.name.replace(" ", "").replace("/", ""))
          .transition()
          .style("stroke-width", 1.5);
      })
      
  // Legend Labels
  issue.append("text")
      .attr("x", 15) 
      .attr("y", function (d, i) { return scrubber_container.height+graph_margin.top + (legendSpace)+i*(legendSpace); })  // (return (11.25/2 =) 5.625) + i * (5.625) 
      .text(function(d) { return d.name; }); 



// HOVER LINE
  var hoverLineGroup = svg.append("g") 
            .attr("class", "hover-line");

  var hoverLine = hoverLineGroup // Create line with basic attributes
        .append("line")
            .attr("id", "hover-line")
            .attr("x1", chart_margin.left + graph_margin.left)
            .attr("x2", chart_margin.left + graph_margin.left) 
            .attr("y1", graph_container.y + graph_margin.top)
            .attr("y2", chart_container_height) //graph_container.y + graph_margin.top + graph_height)
            .style("pointer-events", "none") // Stop line interferring with cursor
            .style("opacity", 1e-6); // Set opacity to zero 


  var hoverDate = hoverLineGroup
        .append('text')
            .attr("class", "hover-text")
            .attr("y", graph_container.y + graph_margin.top - 6)
            .attr("text-anchor", "middle");
            //.style("fill", "#E6E7E8");

  var columnNames = d3.keys(data[0]) //grab the key values from your first data row
                                     //these are the same as your column names
                  .slice(1); //remove the first column name (`date`);

  var focus = issue.select("g") // create group elements to house tooltip text
      .data(columnNames) // bind each column name date to each g element
    .enter().append("g") //create one <g> for each columnName
      .attr("class", "focus"); 


  // The data values dyanmically updated based on hoverline
  focus.append("text") // http://stackoverflow.com/questions/22064083/d3-js-multi-series-chart-with-y-value-tracking
        .attr("class", "tooltip")
        .attr("x", 100) // position tooltips  
        .attr("y", function (d, i) { return (legendSpace)+i*(legendSpace) + graph_container.y + graph_margin.top; }); // (return (11.25/2 =) 5.625) + i * (5.625) // position tooltips       

  // Add mouseover events for hover line.
  d3.select("#mouse-tracker") // select chart plot background rect #mouse-tracker
  .on("mousemove", mousemove) // on mousemove activate mousemove function defined below
  .on("mouseout", function() {
      hoverDate
          .text(null) // on mouseout remove text for hover date

      d3.select("#hover-line")
          .style("opacity", 1e-6); // On mouse out making line invisible
      
      focus.select("text").text("");    
          
  });

  function mousemove() { 
      var mouse_x = d3.mouse(this)[0]; // Finding mouse x position on rect
      var graph_x = xScale.invert(mouse_x); // 

      //var mouse_y = d3.mouse(this)[1]; // Finding mouse y position on rect
      //var graph_y = yScale.invert(mouse_y);
      //console.log(graph_x);
      
      var format = d3.time.format('%b %d %Y'); // Format hover date text to show three letter month and full year
      
      hoverDate.text(format(graph_x)) // scale mouse position to xScale date and format it to show month and year
        .attr("x", mouse_x)


      d3.select("#hover-line") // select hover-line and changing attributes to mouse position
          .attr("x1", mouse_x) 
          .attr("x2", mouse_x)
          .style("opacity", 1); // Making line visible

      // Legend tooltips // http://www.d3noob.org/2014/07/my-favourite-tooltip-method-for-line.html

      var mousex = d3.mouse(this)[0] - chart_margin.left - graph_margin.left;

      var x0 = xScale.invert(mousex), /* d3.mouse(this)[0] returns the x position on the screen of the mouse. xScale.invert function is reversing the process that we use to map the domain (date) to range (position on screen). So it takes the position on the screen and converts it into an equivalent date! */
      i = bisectDate(data, x0, 1), // use our bisectDate function that we declared earlier to find the index of our data array that is close to the mouse cursor
      /*It takes our data array and the date corresponding to the position of or mouse cursor and returns the index number of the data array which has a date that is higher than the cursor position.*/
      d0 = data[i - 1],
      d1 = data[i],
      /*d0 is the combination of date and rating that is in the data array at the index to the left of the cursor and d1 is the combination of date and close that is in the data array at the index to the right of the cursor. In other words we now have two variables that know the value and date above and below the date that corresponds to the position of the cursor.*/
      d = x0 - d0.date > d1.date - x0 ? d1 : d0;
      /*The final line in this segment declares a new array d that is represents the date and close combination that is closest to the cursor. It is using the magic JavaScript short hand for an if statement that is essentially saying if the distance between the mouse cursor and the date and close combination on the left is greater than the distance between the mouse cursor and the date and close combination on the right then d is an array of the date and close on the right of the cursor (d1). Otherwise d is an array of the date and close on the left of the cursor (d0).*/

      //d is now the data row for the date closest to the mouse position

      focus.select("text").text(function(columnName){
         //because you didn't explictly set any data on the <text>
         //elements, each one inherits the data from the focus <g>

         return (d[columnName]);
      });
  }; 

  //for brusher of the slider bar at the bottom


  function brushstart() {
    d3.selectAll("#fake-brush").classed("brush",false);
  };      
  
  function brushend() {

    xScale.domain(brush.empty() ? scrubberxScale.domain() : brush.extent()); // If brush is empty then reset the Xscale domain to default, if not then make it the brush extent 

    if(brush.empty()){
      //stylize the fake brush like it's the brush
      d3.selectAll("#fake-brush").classed("brush",true);
    } else {
      d3.selectAll("#fake-brush").classed("brush",false);
      
    }

    svg.select(".x.axis") // replot xAxis with transition when brush used
          .transition()
          .call(xAxis);
    svg.select("#x-gridlines")     
      .transition()
      .call(make_x_gridlines());

    maxY = findMaxY(categories); // Find max Y rating value categories data with "visible"; true
    yScale.domain([0,maxY]); // Redefine yAxis domain based on highest y value of categories data with "visible"; true
    
    svg.select(".y.axis") // Redraw yAxis
      .transition()
        .call(yAxis);   
    svg.select("#y-gridlines")     
      .transition()
      .call(make_y_gridlines());
  

    issue.select("path") // Redraw lines based on brush xAxis scale and domain
      .transition()
      .attr("d", function(d){
          return d.visible ? line(d.values) : null; // If d.visible is true then draw line for this d selection
      });
    
  };      

}); // End Data callback function
  
  function findMaxY(data){  // Define function "findMaxY"
    var maxYValues = data.map(function(d) { 
      if (d.visible){
        return d3.max(d.values, function(value) { // Return max rating value
          return value.rating; })
      }
    });
    return d3.max(maxYValues);
  }