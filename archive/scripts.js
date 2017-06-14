// cd .... D3
// ruby -run -e httpd . -p 8080
// view localhost:3000



// set the dimensions and margins of the graph
var margin = {top: 20, right: 20, bottom: 80, left: 150},
    width = 1000 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

// set up time parser
var parseTime = d3.timeParse("%d-%b-%y");

// set the ranges
var x = d3.scaleTime().range([0, width]); //! scaleTime don't know alot about it
var ybtc = d3.scaleLinear().range([height, 0]);
var yeth = d3.scaleLinear().range([height, 0]);


// define the line
var valueline = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return ybtc(d.btc); });

// define the line
var valueline2 = d3.line()
    .curve(d3.curveCatmullRom)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return yeth(d.eth); });


// define the area
var area = d3.area()
    .x(function(d) { return x(d.date); })
    .y0(height)
    .y1(function(d) { return ybtc(d.btc); });

// append the svg obgect to the body of the page
// appends a 'group' element to 'svg'
// moves the 'group' element to the top left margin
var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");

// Get the data
d3.csv("stocks.csv", function(error, data) {
  if (error) throw error;

  // format the data
  data.forEach(function(d) {
      d.date = parseTime(d.date);
      d.btc = +d.btc;
      d.eth = +d.eth;
  });

  // Scale the range of the data
  x.domain([parseTime("1-Apr-12"), d3.max(data, function(d) { return d.date; })]);
  ybtc.domain([0, d3.max(data, function(d) { return d.btc; })]);
  yeth.domain([0, d3.max(data, function(d) { return d.eth; })]);


  // Add the valueline path.
  svg.append("path")
      .data([data])
      .attr("class", "linebtc")
      .style("stroke-dasharray", ("3, 3")) 
      .attr("d", valueline);
    
  // add the area
  svg.append("path")
    .data([data])
    .attr("class", "area")
    .attr("d", area);
    

  // Add the valueline path.
  svg.append("path")
      .data([data])
      .attr("class", "lineeth")
      .attr("d", valueline2);



  dataEnter = svg.selectAll("dot")
      .data(data)
    .enter();
    
  dataEnter.append("circle")
      .attr("r", 5)
      .attr("cx", function(d) { return x(d.date); })
      .attr("cy", function(d) { return ybtc(d.btc); });

dataEnter.append("circle")
      .attr("r", 5)
      .attr("cx", function(d) { return x(d.date); })
      .attr("cy", function(d) { return yeth(d.eth); });

  // Add the X Axis
  svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d")))
      .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");



  // text label for the x axis
  svg.append("text")
      .attr("x", (width/2))
      .attr("y", (height+margin.top+margin.bottom))
      .attr("dy", "-2em")
      .style("text-anchor", "middle")
      .text("Date");



  // Add the Y Axis
  svg.append("g")
      .attr("class", "ybtc")
      .call(d3.axisLeft(ybtc));

  svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x",0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Value");


  // Add the Y Axis
  svg.append("g")
      .call(d3.axisLeft(yeth))
      .attr("class", "yeth")
      .attr("transform", "translate(-40,0)");


  // Title
  svg.append("text")
      .attr("x", (width / 2))
      .attr("y", 0 - (margin.top / 2))
      .attr("dy", "1em")
      .attr("text-anchor", "middle")
      .style("font-size", "20px")
      .style("text-decoration", "underline")
      .text("Value vs Date Graph");

});
