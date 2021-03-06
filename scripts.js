/* global d3 */
/* global yAxis */
/* global visibleMeasures */
/* global visibleEvents */

////////////////
// LOAD TSVS AND HANDLE graphData
///////////////

d3.tsv("graph_data.tsv", function(error, graphData) { 
    if (error)
      handleError(error);
    else
      d3.tsv("timeline_data.tsv", function(error, timelineData) { 
        if (error)
          handleError(error);
        else
          timelineData.forEach(function(d) {
            d.visible = (d.visible == 'true');
          });
          drawChart(graphData, timelineData);
      });
});

function handleError(error){
  console.error('There was an error in loading one of the data files: ' + error);
}




//////////////
/// DRAW THE CHART
//////////////

function drawChart(graphData,timelineData){  

  


  // MARGINS, HEIGHTS, WIDTHS, ETC
  var svg_margin = {top: 0, bottom: 0, right: 0, left: 20},
      
      chart_margin = {top: 0, bottom: 20, right: 60, left: 200},
      chart_width = 700,
      
      scrubber_margin = { top: 20, bottom: 0, right: 0, left: 0},
      scrubber_height = 50,
      scrubber_container = { height: scrubber_height + scrubber_margin.top + scrubber_margin.bottom, y: chart_margin.top},
      
      graph_margin = {top: 50, bottom: 20, right: 0, left: 0},
      graph_height = 300,
      graph_container = { y: chart_margin.top + scrubber_container.height, height: graph_height + graph_margin.top + graph_margin.bottom },
      
      checkbox_size = 20,
      
      
      timeline_margin = {top: 40, bottom: 20, right: 0, left: 0},
      timeline_row_height = 30,
      timeline_row_padding = 5,

      // set dynamically because these depend on how many timleine data are shown
      timeline_height,
      timeline_container,
      chart_container_height,

      yAxisSpacing = 40,
      
      btn_width = 100,
      btn_height = 25;


  updateVisibleEvents();
  updateDynamicDimensions();

  //////////////
  // PROCESS THE DATA
  //////////////
  // measures = array of the measure names
  // graphData = array of hashes = [date, measure1, measure2, measure3]
  // categories = [] of :name, :values = {:date, :rating}, :max_rating, :visible
  
  var measures = d3.keys(graphData[0]).filter(function(key) { // Set the domain of the color ordinal scale to be all the csv headers except "date", matching a color to an measure
    return key !== "date"; 
  });
  
  // FORMAT DATES USING PARSER
  var parseDate = d3.time.format("%m/%d/%Y").parse;
  graphData.forEach(function(d) { d.date = parseDate(d.date); });


  var yScaleHundreds = ["Daily Health","Pain", "Fatigue", "Sleep Disturbance", "Anxiety", "Depression"]


  // FORMAT DATA FROM TSV INTO CATEGORY ARRAY
  var categories = measures.map(function(name) { // Nest the data into an array of objects with new keys
    var rating = 0;
    var highest_rating_so_far = 0;

    return {
      name: name, // "name": the csv headers except date
      values: graphData.map(function(d) { // "values": which has an array of the dates and ratings
        rating = +(d[name]);
        if (rating > highest_rating_so_far)
          highest_rating_so_far = rating;
        
        return {
          date: d.date, 
          rating: +(d[name]),
          };
      }),
      max_rating: highest_rating_so_far,
      yDomainMax: yScaleHundreds.includes(name) ? 100 : highest_rating_so_far,
      visible: (name == "Daily Health" || name == "Steps" || name == "Sleep Disturbance" || name == "Depression") ? true : false // "visible": all false except for economy which is true.
    };
  });
  
  updateVisibleMeasures();


  // SET UP COLOR DOMAINS
  var graphColor = d3.scale.category20()
    .domain(measures);
  var timelineColor = d3.scale.category20c()
    .domain(timelineData.map(function(event_type){ return event_type.name}));

  var bisectDate = d3.bisector(function(d) { return d.date; }).left;





  //////////////
  // SCALES
  //////////////
  var yScales = {};

  categories.forEach(function(measure){
    var aScale = d3.scale.linear()
      .range([graph_height, 0])
      .domain([0,measure.yDomainMax]);
    yScales[measure.name] = aScale;
  });
  
  var yScale = d3.scale.linear().range([graph_height, 0]);

  // X SCALE
  var xScale = d3.time.scale()
      .range([0, chart_width])
      .domain(d3.extent(graphData, function(d) { return d.date; })), // extent = highest and lowest points, domain is graphData, range is bouding box
  
      scrubberxScale = d3.time.scale()
      .range([0, chart_width])
      .domain(xScale.domain()); // Setting a duplicate xdomain for brushing reference later
  

  

  
  /////// 
  // SVG - DRAW THE CANVAS
  //////

  
  var svg = d3.select("body").append("svg")
    .attr("id", "svg")
    .attr("width", chart_width + chart_margin.left + chart_margin.right)
    .attr("height", chart_container_height+chart_margin.top + chart_margin.bottom);




  /////// 
  // INVISIBLE UTILITY RECTS
  //////

  // MOUSE TRACKER (invisible rect)
  var mouseTracker = svg.append("rect")
    .attr("width", chart_width)
    .attr("x", chart_margin.left) 
    .attr("y", graph_container.y + graph_margin.top)
    .attr("id", "mouse-tracker")
    .style("fill", "white");

  // CLIP PATH RECT AROUND GRAPH (to hide parts of lines that are out of current view)
  svg.append("defs") //todo probably assumes xy of 00 but we do need to place it with the graph
    .append("clipPath") 
      .attr("id", "clip")
      .append("rect")
      .attr("width", chart_width)
      .attr("height", chart_container_height); 

  
  
  
  /////////////
  // GRIDLINES
  ////////////
  
  // Y GRID
  var yGridlines = d3.svg.axis()
    .scale(yScale)
    .orient("left")
    .ticks(5)
    .tickSize(-chart_width, 0, 0)
    .tickFormat("");
  svg.append("g")         
      .attr("class", "grid")
      .attr("id","y-gridlines")
      .attr("transform", "translate("+eval(chart_margin.left+graph_margin.left)+"," + eval(graph_container.y+graph_margin.top) + ")")
      .call(yGridlines);
      
  // X GRID
  var xGridlines = d3.svg.axis()
    .scale(xScale)
    .orient("bottom")
    .ticks(10)
    .tickFormat("");
  svg.append("g")         
      .attr("class", "grid")
      .attr("id","x-gridlines")
      .attr("transform", "translate("+eval(chart_margin.left+graph_margin.left)+"," + eval(graph_container.y+graph_margin.top) + ")");
  
  redrawChartHeight();
  
  // SCRUBBER X GRID
  var scrubberxGridlines = d3.svg.axis()
    .scale(scrubberxScale)
    .tickFormat("")
    .ticks(10)
    .tickSize(scrubber_height, 0, 0);


  // WHITE RECT TO HIDE GRID BETWEEEN GRAPH AND TIMELINE
  svg.append("rect")
    .attr("x", chart_margin.left)
    .attr("y", graph_container.y + graph_margin.top + graph_height)
    .attr("height", graph_margin.bottom + timeline_margin.top + timeline_row_padding)
    .attr("width", chart_width)
    .attr("fill", "#FFF");

  
  
  /////////
  // AXISES aka AXES
  /////////
    
  // Y-AXISes aka AXES
  drawYAxes();

 
  // X AXIS
  var xAxis = d3.svg.axis()
      .scale(xScale)
      .orient("bottom")
      .ticks(8)
      .tickFormat(d3.time.format("%b %-d"));
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate("+chart_margin.left+","+eval(graph_container.y+graph_margin.top + graph_height)+")")
      .call(xAxis)
      .style("pointer-events", "none"); // Stop line interferring with cursor

   
  // SCRUBBER X AXIS 
  var scrubberxAxis = d3.svg.axis() // xAxis for brush slider
      .scale(scrubberxScale)
      .orient("top")
      .ticks(10)
      .tickSize(0, 0, 0)
      .tickFormat(d3.time.format("%b '%y"));


  
  function drawYAxes(){
    
    var yAxis = svg.selectAll(".yAxis")
      .data(visibleMeasures, function(d){return d.name;});
      
    yAxis.exit().remove();
    
    yAxis.enter().append("g")
      .attr("class", "yAxis")
      .attr("fill", function(d){ return graphColor(d.name) })
      .each(function(d) { // IMPORTANT FOR UNDERSTANDING THIS: https://stackoverflow.com/questions/19040846/create-axes-using-data-binding-in-d3
        

        var axis = d3.svg.axis()
          .scale(yScales[d.name])
          .orient("left")
          .tickValues([0,d.yDomainMax])
          //.tickValues([0,d.yDomainMax*1/5,d.yDomainMax*2/5,d.yDomainMax*3/5,d.yDomainMax*4/5,d.yDomainMax])
          .tickFormat(function(d) { return abbrNum(d,1); })
          .ticks(5);
        axis(d3.select(this));
      })
      .append("text")
        .attr("x", -15)
        .attr("y", -15)
        .text(function(d){ return d.name })
        .attr("transform", "rotate(-20)");
        //.attr("text-anchor", "start");
      
    yAxis.attr("transform", function(d) { return "translate("+eval(chart_width+chart_margin.left + (-yAxisSpacing * visibleMeasures.indexOf(d)) )+", "+eval(graph_container.y+graph_margin.top)+")" });

      
  }







  //////////
  //TIMELINE
  //////////
  
  
  // TIMELINE TEXT TITLE
  svg.append("text")
    .attr("class", "timeline-title")
    .text("Timeline")
    .style("text-anchor", "end")
    .attr("x", chart_margin.left - 10)
    .attr("y", (timeline_container.y + timeline_margin.top - 5));
    
  
  updateTimelineData();
  
  var event;
  
  function updateTimelineData(){
    
    var event_categories = [];
  
    // MAIN TIMELINE BOUNDING BOX
    event = svg.selectAll(".event")
        .data(visibleEvents, function(d){return d.name;}); // Select nested data and append to new svg group elements
    
    event.exit().remove();
    
    var eventEnterGroup = event.enter().append("g")
      .attr("class", "event");

    // BACKGROUND ROW FOR EACH EVENT
    eventEnterGroup.append("rect")
      .attr("x", chart_margin.left)
      .attr("y", timeline_row_padding)
      .attr("height", timeline_row_height - timeline_row_padding)
      .attr("width", chart_width)
      //.attr("fill", function(d){ return (d.type != "Medication") ? "#777" : "#BBB"})
      .attr("fill", "#DDD")
      .style("pointer-events", "none") // Stop line interferring with cursor
      .style("opacity", .2);
  
    // LABELS FOR EACH EVENT
    eventEnterGroup.append("text")
      .attr("x",chart_margin.left - 10)
      .style("fill", function(d) { return timelineColor(d.name); })
      .style("text-anchor", "end")
      .attr("class","timeline-label label")
      .text(function(d) { return d.name})
      .attr("dy", timeline_row_height - timeline_row_padding - 3);
  
  
    // TIMELINE LINES
    eventEnterGroup.append("path")
      .attr("class", "timeline-line")
      .style("pointer-events", "none") // Stop line interferring with cursor
      .attr("id", function(d) {
        return "event-line-" + d.name.replace(" ", "").replace("/", ""); // Give line id of line-(insert measure name, with any spaces replaced with no spaces)
      })
      .attr("transform", "translate("+chart_margin.left+","+timeline_row_padding*1.5+")")
      .style("stroke", function(d) { return timelineColor(d.name); })
      .style("stroke-width", (timeline_row_height-(timeline_row_padding*2))*2)
      .attr("clip-path", "url(#clip)")//use clip path to make irrelevant part invisible
      .attr("d",function(d){ return generateTimelinePath(d.dates) });   

    // // EVENT ADD BTN
    // var addEventOccuranceBtn = eventEnterGroup.append("text")
    // .attr("x",chart_width +chart_margin.left + 10)
    // .attr("y",25)
    // .text("+")
    // .attr("class","plus")
    // .style("text-anchor", "start");

    // Move all events into their appropriate position
    event.attr("transform", function(d,i) { return "translate(0, "+eval(timeline_container.y+timeline_margin.top+i*timeline_row_height) +")"});

    // addEventOccuranceBtn.on("click", function(d){
    //   alert(d.name + ": This will allow you to add an occurance.")
    // });
    
  }



 
  ///////
  //SCRUBBER
  ///////

  var scrubber = svg.append("g") // Brushing scrubber box container
    .attr("transform", "translate(" + chart_margin.left + "," + scrubber_container.y + ")") // todo scrubber.x scrubber.y
    .attr("class", "scrubber");
    
  var brush = d3.svg.brush()
    .x(scrubberxScale)
    .on("brushend", scrubberAdjustComplete)
    .on("brushstart", scrubberAdjustStart);

  var scrubberArea = d3.svg.area() // Set attributes for area chart in brushing scrubber graph
    .interpolate("monotone")
    .x(function(d) { return scrubberxScale(d.date); }) // x is scaled to scrubberxScale
    .y0(scrubber_container.y + scrubber_margin.top + scrubber_height) // Bottom line begins at height2 (area chart not inverted) 
    .y1(scrubber_container.y + scrubber_margin.top); // Top line of area, 0 (area chart not inverted)

  //plot the rect as the bar in the scrubber
  scrubber.append("path") // Path is created using svg.area details
    .attr("class", "area")
    .attr("fill", "none")
    .attr("d", scrubberArea(categories[0].values)); // pass first categories data .values to area path generator 
    //.attr("fill", "#F1F1F2");

  scrubber.append("rect")
    .attr("fill","#DEDEDE")
    .attr("opacity", "0.5")
    .attr("height", scrubber_height*2/3) // Make brush rects same height 
    .attr("width", chart_width)
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/6));
      //.attr("fill", "#E6E7E8"); 

  scrubber.append("g") // Create scrubber x Gridlines
      .attr("class", "scrubber-grid")
      .attr("transform", "translate(0," + eval(scrubber_container.y + scrubber_margin.top) + ")")
      .call(scrubberxGridlines);


  scrubber.append("g") // Create scrubber xAxis
      .attr("class", "scrubber-dates")
      .attr("transform", "translate(0," + eval(scrubber_container.y + scrubber_margin.top ) + ")")
      .call(scrubberxAxis);

  // INSERT A FAKE BRUSH SELECTION THAT SHOWS ALL WHEN NO TIME SELECTED
  scrubber.append("rect")
    .attr("class", "brush")
    .attr("id","fake-brush")
    .attr("fill","none")
    .attr("height", scrubber_height*2/3) // Make brush rects same height 
    .attr("width", chart_width)
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/6));

  //append the brush for the selection of subsection  
  scrubber.append("g")
    .attr("class", "x brush")
    .call(brush)
    .selectAll("rect")
    .attr("height", scrubber_height*2/3) // Make brush rects same height 
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/6));

  // var handle = scrubber.append("rect")
  //   .attr("class", "something")
  //   .style("fill", "#000")
  //   .attr("height", scrubber_height*2/3) // Make brush rects same height 
  //   .attr("width", 5);

  // SCRUBBER TEXT LABEL
  scrubber.append("text")
    .attr("class", "scrubber-label")
    .text("Select Date Range to Show (Strech and Pan the Green Box)")
    .style("text-anchor", "middle")
    .style("pointer-events", "none") // Stop line interferring with cursor
    .attr("x", chart_width /2 )
    .attr("y", (scrubber_container.y + scrubber_margin.top + scrubber_height/2 + 5));


  /////////////////
  // VISIBLE EYES (to open menu)
  ////////////////
  
  var eye = svg.append("g");
  
  
  eye.append("image")
    .attr("class", "eye")
    .attr("xlink:href", "images/eye.svg")
    .attr("height","20")
    .attr("x", chart_margin.left)
    .attr("y", (graph_container.y + graph_margin.top - 25));

  eye.append("image")
    .attr("class", "eye")
    .attr("xlink:href", "images/eye.svg")
    .attr("height","20")
    .attr("x", chart_margin.left)
    .attr("y", (timeline_container.y + timeline_margin.top - 20));


  
  


  /////////////////
  // GRAPH 
  /////////////////
  
  
  // GRAPH TEXT LABEL
  svg.append("text")
    .attr("class", "graph-title")
    .text("Time Series")
    .style("text-anchor", "end")
    .attr("x", chart_margin.left - 10)
    .attr("y", (graph_container.y + graph_margin.top - 10));
  
  
  // GENERATE LINES
  var line = d3.svg.line()
      .interpolate("basis")
      .x(function(d) { return xScale(d.date); })
      .defined(function(d) { return d.rating; });  // Hiding line value defaults of 0 for missing data

  var measure = svg.selectAll(".measure")
      .data(categories) // Select nested data and append to new svg group elements
    .enter().append("g")
      .attr("class", "measure");   

  measure.append("path")
      .attr("class", "line")
      .style("pointer-events", "none") // Stop line interferring with cursor
      .attr("id", function(d) {
        return "line-" + d.name.replace(" ", "").replace("/", ""); // Give line id of line-(insert measure name, with any spaces replaced with no spaces)
      })
      .attr("d", function(d) { 
        return drawGraphLine(d);
      })
      .style("opacity", function(d){ return d.visible? 1 : 1e-6})
      .attr("transform", "translate("+chart_margin.left+", "+eval(graph_container.y+graph_margin.top)+")")
      .attr("clip-path", "url(#clip)")//use clip path to make irrelevant part invisible
      .style("stroke", function(d) { return graphColor(d.name); });
      
      
  /////////////
  // GRAPH LEGEND & LABELS
  /////////////
  var legendSpace = graph_height / categories.length; // 450 (just changed to height)/number of measures (ex. 40)    


  /////////////////
  // LINKS
  ////////////////
  
  // BUTTON TO TOGGLE ON/OFF LINE SELECTION PANEL
  // var legendToggleBtn = svg.append("g")
  //   .attr("class", "legend-toggle-btn")
  //   .attr("transform", "translate(20,50)");
  

  // var editlink = svg.append("svg:a")
  //   .attr("xlink:href", "https://cgibdweb-test.med.unc.edu/ccfapartners/updateHealthData.php?code=24662&visitid=2&category=promis&var=")
  //   //.attr("target", "_blank")
  // editlink.append("text")
  //   .text("Log Update")
  //   .attr("class","link")
  //   .style("text-anchor", "end")
  //   .attr("transform", "translate(915,270)rotate(90)");    


  ///////////
  // Line Labels
  ///////////
  var LineLabelContainer = svg.append("g");

  var lineLabel = LineLabelContainer.selectAll(".line-label")
    .data(categories)
  .enter().append("text")
    .attr("class", "line-label")
    .text(function(d){ return d.name})
    .attr("x",chart_margin.left - 10)
    .style("fill", function(d) { return graphColor(d.name); })
    .style("text-anchor", "end")
  
  updateLineLabel();

  function updateLineLabel(){
    var first_date = xScale.domain()[0];
    var firstValues = graphData[0];
    var i = bisectDate(graphData, first_date, 1); // use our bisectDate function that we declared earlier to find the index of our data array that is close to the mouse cursor
    //console.log(i)
  
    lineLabel
      .attr("y",function(d){ return graph_container.y+graph_margin.top+yScales[d.name](graphData[i][d.name]) })
      .attr("opacity", function(d){ return d.visible ? 1 : 0});
  }  
  
  
  // 
  
  
  /////////////
  // ITEM SELECT MENU
  ////////////
 
  var LegendContainer = svg.append("g")
    .attr("opacity","0");
 
  LegendContainer.append("rect")
    .attr("opacity","0.7")
    .attr("rx",5)
    .attr("ry",5)
    .attr("y", graph_container.y)
    .attr("width", chart_margin.left - 40)
    .attr("height", graph_container.height + timeline_container.height)
    .attr("fill","#FCFCFC")
    .attr("stroke", "#333");

  function measureToggleAction(d){
      // Add/Remove Line Path from Graph
      measure.select("path")
        .transition()
        .style("opacity", function(d){ return d.visible ? 1 : 1e-6}); // Set opacity to zero 
      
      // Add/Remove Hover Value Visibility
      // var hoverValueGroup = d3.select(".hover-line-group").selectAll(".hover-value-group")
      // .data(categories.filter(function(c){ return c.visible })); // Select nested data and append to new svg group elements
      hoverValueGroup.style("opacity", function(d){ return d.visible ? 1 : 1e-6}); // Set opacity to zero 
      
      updateVisibleMeasures();
      updateLineLabel();
      
      drawYAxes();
  }
  
  function timelineToggleAction(d){
    updateVisibleEvents();
    updateDynamicDimensions();
    updateTimelineData();
    redrawChartHeight();
  }
  
  function updateDynamicDimensions(){
    timeline_height = timeline_row_height * visibleEvents.length + timeline_row_padding;
    timeline_container = { y: graph_container.y+graph_container.height, height: timeline_height + timeline_margin.top + timeline_margin.bottom };
    chart_container_height = scrubber_container.height + graph_container.height + timeline_container.height;
  }
  
  function redrawChartHeight(){
    // Update X Gridlines
    xGridlines.tickSize(timeline_container.height+graph_height, 0, 0);
    svg.select("#x-gridlines").call(xGridlines);
    
    // Update Mouse Tracker Rect
    mouseTracker.attr("height", graph_height + graph_margin.bottom + timeline_margin.top + timeline_height);                                   
  }

  var measureSelectGroup;
  generateDataSelects("measure-select-group",measureSelectGroup, categories, measureToggleAction, (graph_container.y+graph_margin.top), graphColor);
  var timelineSelectGroup;
  generateDataSelects("timeline-select-group",timelineSelectGroup, timelineData, timelineToggleAction, (timeline_container.y + timeline_margin.top), timelineColor);

  LegendContainer.append("text")
    .text("Visible Data")
    .attr("class","visible-heading")
    .style("text-anchor", "start")
    .attr("transform", "translate(10,90)");
    

  LegendContainer.append("text")
    .text("Time Series")
    .attr("class","heading")
    .style("text-anchor", "start")
    .attr("transform", "translate(10,120)");
    

  LegendContainer.append("text")
    .text("Timeline")
    .attr("class","heading")
    .style("text-anchor", "start")
    .attr("transform", "translate(10,480)");
    
  // LegendContainer.append("text")
  //   .text("Add New Event Type")
  //   .attr("class","link")
  //   .style("text-anchor", "start")
  //   .attr("transform", "translate(10,780)")   
  //   .on("click", function(d){
  //     alert("This will allow you to add a new event type.")
  //   });

  function generateDataSelects(className,dataSelectGroup, data, toggleAction, start_y, colorScale){
    dataSelectGroup = LegendContainer.selectAll(className)
      .data(data)
    .enter().append("g")
      .attr("class", className);
  
    // Legend Labels
    dataSelectGroup.append("text")
        .attr("class", "label")
        .attr("x", checkbox_size + 17) 
        .attr("y", function (d, i) { return start_y + (legendSpace)+i*(legendSpace) + checkbox_size / 6; })  // (return (11.25/2 =) 5.625) + i * (5.625) 
        .text(function(d) { return d.name; }); 
  
    // Checkboxes
    var dataSelectCheckbox = dataSelectGroup.append("rect")
      .attr("class", "legend-box")
      .attr("width", checkbox_size)
      .attr("height", checkbox_size)                                    
      .attr("x", 10) 
      .attr("y", function (d, i) { return start_y + (legendSpace)+i*(legendSpace) -14; })  // spacing
      .attr("fill",function(d) { return colorScale(d.name) }) // If array key "visible" = true then graphColor rect, if not then make it grey  //return d.visible ? color(d.name) : "#F1F1F2"; // If array key "visible" = true then color rect, if not then make it grey 
      .attr("stroke", "#000" )
      .style("stroke-width", 1.5);
    
    // Label Text  
    var checkmark = dataSelectGroup.append("text")
      .attr("class", "checkmark")
      .attr("x", checkbox_size / 2 + 10) 
      .attr("y", function (d, i) { return start_y + (legendSpace)+i*(legendSpace) + checkbox_size / 5; })  // (return (11.25/2 =) 5.625) + i * (5.625) 
      .text("x")
      .style("text-anchor", "middle")
      .attr("display", function(d) { return d.visible ? "block" : "none"; });
      //.style("pointer-events", "all");

    //////////////////
    // GRAPH CHECKBOX INTERACTION
    //////////////////
    dataSelectGroup.on("click", function(d){ // On click toggle d.visible 
      d.visible = !d.visible; // If array key for this data selection is "visible" = true then make it false, if false then make it true
      // Add/Remove Check from box
      d3.select(this).select(".checkmark")
        .attr("display", function(d){ return d.visible ? "block" : "none"; });     
      
      toggleAction.call(d);
    });

  }



  //////////////////////////
  // HOVER LINE & DATA VALUES
  ////////////////////////
  
  var hoverLineGroup = svg.append("g") 
    .attr("class", "hover-line-group")
    .style("pointer-events", "none") // Stop line interferring with cursor
    .style("opacity", 1e-6); // Set opacity to zero 


  var hoverLine = hoverLineGroup // Create line with basic attributes
    .append("line")
      .attr("id", "hover-line")
      .attr("x1", 0)
      .attr("x2", 0) 
      .attr("y1", 0)
      .attr("y2", chart_container_height - scrubber_container.height - chart_margin.bottom)
      .style("pointer-events", "none") // Stop line interferring with cursor

  // HOVER DATE
  var hoverDateGroup = hoverLineGroup.append("g")
    .attr("transform", "translate(0,"+eval(graph_container.height - graph_margin.top+ 10)+")");

  var hoverDateBG = hoverDateGroup.append('rect')
    .attr("width","120")
    .attr("height","30")
    .attr("x", -60)
    .attr("fill", "#EEE")
    .attr("stroke-width", 0)
    
  var hoverDate = hoverDateGroup.append('text')
    .attr("class", "hover-date-text")
    .attr("text-anchor", "middle")
    .attr("dy","1.25em")

  // HOVER VALUES
  var hoverValueGroup = d3.select(".hover-line-group").selectAll(".hover-value-group")
    .data(categories); // Select nested data and append to new svg group elements
  hoverValueGroup.enter().append("g")
    .attr("class", "hover-value-group")
    .attr("transform", "translate(0,0)")
    .style("opacity", function(d){ return d.visible ? 1 : 1e-6}); // Set opacity to zero 

  //hoverValueGroup.exit().remove();
  
  var hoverValueBG = hoverValueGroup.append('rect')
    .attr("width","50")
    .attr("height","30")
    .attr("x", 0)
    .attr("y", -15)
    .attr("fill", "#FFF")
    .attr("stroke-width", 0)
    .style("opacity", 0.5);
  
  var hoverValueText = hoverValueGroup.append('text')
    .attr("class", "hover-value-text")
    .attr("text-anchor", "right")
    .attr("x",10)
    .attr("y",0) // just gotta figure out location now.
    .attr("dy", ".35em")
    .style("fill", function(d) { return graphColor(d.name); });
  
  

  
  
  
  
  
  
  
/////////////////  
// INTERACTION
/////////////////
 
 

  /// SCRUBBER MOVEMENT RESPONSE
  ////////
 
  function scrubberAdjustStart() {
    d3.selectAll("#fake-brush").classed("brush",false);
  }   
  
  function scrubberAdjustComplete() {
    // TOGGLE FAKE BRUSH EFFECT IF NO AREA SELECTED
    if(brush.empty())
      d3.selectAll("#fake-brush").classed("brush",true);
    else
      d3.selectAll("#fake-brush").classed("brush",false);
  
  
    // console.log(brush.extent()[0]);
    // handle.attr("transform","translate("+xScale(brush.extent()[0])+",0)");   
 
    // var x = d3.scale.linear().range([0, chart_width]),
    // y = d3.random.normal(scrubber_height / 2, scrubber_height / 8);
    
    // var s = d3.event.selection;
    
    // if (s == null) {
    //   //handle.attr("display", "none");
    //   //circle.classed("active", false);
    //   console.log(brush.extent()[0]);
    //   handle.attr("transform","translate("+xScale(brush.extent()[0])+",0)");
    // } else {
    //   //var sx = s.map(x.invert);
    //   // handle.attr("x",xScale(brush.extent()[0]));
    //   // console.log
    //   //handle.attr("transform", function(d, i) { return "translate(" + [ s[i], - scrubber_height / 4] + ")"; });
    // }

   
   
   
    // RESCALE AXES
    xScale.domain(brush.empty() ? scrubberxScale.domain() : brush.extent()); // If brush is empty then reset the Xscale domain to default, if not then make it the brush extent 
    svg.select(".x.axis")
      .transition()
      .call(xAxis);
    svg.select("#x-gridlines")    
      .transition()
      .call(xGridlines);
    svg.select("#y-gridlines")     
      .transition()
      .call(yGridlines);
  
    // REDRAW/RESCALE THE GRAPH LINES
    measure.select("path") // Redraw lines based on brush xAxis scale and domain
      .transition()
      .attr("d", function(d){ return drawGraphLine(d); })
    updateLineLabel();

      
    //REDRAW/RESCALE THE TIMELINE LINES
    event.select("path") // Redraw lines based on brush xAxis scale and domain
      .transition()
      .attr("d",function(d){ return generateTimelinePath(d.dates) });   
    
  }    
 
 
 
  //////////////////////
  // HOVER LINE INTERACTION
  //////////////////////////
 

  // Add mouseover events for hover line.
  d3.select("#mouse-tracker") // select chart plot background rect #mouse-tracker
  .on("mousemove", drawHoverLine) // on mousemove activate mousemove function defined below
  .on("mouseout", function() {
      hoverLineGroup.style("opacity", 1e-6); // On mouse out making line invisible
  });

  function drawHoverLine() { 
      var mouse_x = d3.mouse(this)[0] - chart_margin.left - graph_margin.left; // Finding mouse x position on rect
      var graph_x = xScale.invert(mouse_x); // 

      var format = d3.time.format('%b %d %Y'); // Format hover date text to show three letter month and full year
      
      hoverDate.text(format(graph_x)); // scale mouse position to xScale date and format it to show month and year
      hoverLineGroup
        .attr("transform", "translate("+eval(mouse_x+chart_margin.left+graph_margin.left)+","+eval(graph_container.y+graph_margin.top)+")")
        .style("opacity", 1); // Making line visible


      // // Legend tooltips // http://www.d3noob.org/2014/07/my-favourite-tooltip-method-for-line.html

      // var mousex = d3.mouse(this)[0];

      // var x0 = xScale.invert(mousex), /* d3.mouse(this)[0] returns the x position on the screen of the mouse. xScale.invert function is reversing the process that we use to map the domain (date) to range (position on screen). So it takes the position on the screen and converts it into an equivalent date! */
      var x0 = graph_x;
      var i = bisectDate(graphData, x0, 1); // use our bisectDate function that we declared earlier to find the index of our data array that is close to the mouse cursor
      // /*It takes our data array and the date corresponding to the position of or mouse cursor and returns the index number of the data array which has a date that is higher than the cursor position.*/
      //console.log(x0);
      var d0 = graphData[i - 1];
      var d1 = graphData[i];
      // /*d0 is the combination of date and rating that is in the data array at the index to the left of the cursor and d1 is the combination of date and close that is in the data array at the index to the right of the cursor. In other words we now have two variables that know the value and date above and below the date that corresponds to the position of the cursor.*/
      var valueline = x0 - d0.date > d1.date - x0 ? d1 : d0;
      // /*The final line in this segment declares a new array d that is represents the date and close combination that is closest to the cursor. It is using the magic JavaScript short hand for an if statement that is essentially saying if the distance between the mouse cursor and the date and close combination on the left is greater than the distance between the mouse cursor and the date and close combination on the right then d is an array of the date and close on the right of the cursor (d1). Otherwise d is an array of the date and close on the left of the cursor (d0).*/

      // Update the Hover Value Tooltips showing the data values on the graph
      hoverValueGroup.attr("transform", function(d) { return "translate(0,"+yScales[d.name](valueline[d.name])+")" }); //" + function(d){ return yScales["Pain"](valueline[d.name]); } + ")");
      hoverValueText.text(function(d){ return (d.visible && !isNaN(roundToTwo(valueline[d.name]))) ? ("" + roundToTwo( valueline[d.name] )) : "" } );
      hoverValueBG.attr("width", function(d){ return (20 + valueline[d.name].toString().length * 10) });
  } 
 
 
 

  
  eye.on("click", function(){
    if (LegendContainer.attr("opacity") == 1){
      LegendContainer.attr("opacity", "0");
      //measureSelectGroup.style("pointer-events", "none");
    } else { 
      LegendContainer.attr("opacity", "1");
      //measureSelectGroup.style("pointer-events", "all");
    }
  });
 
 
 
 
 
  ////////////////
  // OVERLAYS
  ///////////////
 
  var logUpdateOverlay = svg.append("g")
    .attr("transform","translate("+chart_margin.left+","+graph_container.y+")")
    .attr("class","toggle-one")
    .attr("display", "none");
  logUpdateOverlay.append("rect")
    .attr("opacity","0.7")
    .attr("rx",5)
    .attr("ry",5)
    .attr("width", 400)
    .attr("height", 400)
    .attr("fill","#FCFCFC")
    .attr("stroke", "#333");
  logUpdateOverlay.append("text")
      .text("Log Update Flow Goes Here")
      .attr("dy","1em");

  var addEventOverlay = svg.append("g")
    .attr("transform","translate("+chart_margin.left+","+graph_container.y+")")
    .attr("class","toggle-one")
    .attr("display", "none");
  addEventOverlay.append("rect")
    .attr("opacity","0.7")
    .attr("rx",5)
    .attr("ry",5)
    .attr("width", 400)
    .attr("height", 400)
    .attr("fill","#FCFCFC")
    .attr("stroke", "#333");
  addEventOverlay.append("text")
      .text("Add Event Flow Goes Here")
      .attr("dy","1em");
    
    
  // TRIGGER BUTTONS
  generateBtn("Log Update", function(){ toggleVisible(logUpdateOverlay); })
    .attr("transform", "translate("+eval(chart_margin.left+chart_width - btn_width)+","+ eval(graph_container.y + graph_height + graph_margin.top + graph_margin.bottom + 15)+")");


  generateBtn("Add Event", function(){ toggleVisible(addEventOverlay); })
    .attr("transform", "translate("+eval(chart_margin.left+chart_width - btn_width)+","+ eval(timeline_container.y + timeline_margin.top + timeline_margin.bottom + timeline_height - 10)+")");


 
 
////////// 
// HELPERS 
//////////

  function toggleVisible(div) {
    var state = div.attr("display");
    svg.selectAll(".toggle-one").attr("display","none");
    div.attr("display", state == "none" ? "block" : "none");
  }


  function generateBtn(text, fx){
    var btn = svg.append("g")
      .attr("class", "btn")
    btn.append("rect")
      .attr("width", btn_width)
      .attr("height", btn_height)
      .attr("ry",5)
      .attr("rx",5);      
    btn.append("text")
      .text(text)
      .attr("x", btn_width/2)
      .attr("dy","1.3em")
      .style("text-anchor", "middle")
      .style("pointer-events", "none");
    btn.on("click", fx);
    return btn;
  }  

  function updateVisibleMeasures(){
    visibleMeasures = categories.filter(function(c){ return c.visible });
  }
  
  function updateVisibleEvents(){
    visibleEvents = timelineData.filter(function(c){ return c.visible });
  }
 
  // GENERATE GRAPH LINES FROM DATA
  function drawGraphLine(d){
    var nm = d.name;
    return line.y(function(d) { return yScales[nm](d.rating)})(d.values);
  } 
 
  // GENERATE TIMELINE LINES FROM DATE ARRAY
  function generateTimelinePath(dates){
    dates = JSON.parse(dates);
    var path = "";
    var startDate;
  
    dates.forEach(function(datespan) {
        startDate = parseDate(datespan[0]);
      
        path += "M "+xScale(startDate)+" 0 ";
        if (datespan[1]===null) // means the event is spanning into the future    
          path += "H "+xScale(xScale.domain()[xScale.domain().length-1])+" ";
        else if (datespan[1]===undefined) // means this is not a event that spans, its a one time thing
          path += "H "+xScale(startDate.setDate(startDate.getDate() + 1))+" ";
        else // just use the spans data as defined
          path += "H "+xScale(parseDate(datespan[1]))+" ";
    });
    return path;
  }
  
  
  
  function roundToTwo(num) {    
    //return Math.round(num * 100) / 100;
    return +(Math.round(num + "e+2")  + "e-2");
  }
  
  
  function includes(k) {
    for(var i=0; i < this.length; i++){
      if( this[i] === k || ( this[i] !== this[i] && k !== k ) ){
        return true;
      }
    }
    return false;
  }
  
  
  function shuffle(array) {
      var shuffled_array = new Array;
      let counter = array.length;
  
      // While there are elements in the array
      while (counter > 0) {
          // Pick a random index
          let index = Math.floor(Math.random() * counter);
  
          // Decrease counter by 1
          counter--;
  
          // And swap the last element with it
          let temp = array[counter];
          shuffled_array[counter] = array[index];
          shuffled_array[index] = temp;
      }
  
      return shuffled_array;
  }

}



  // function findMaxY(graphData){  // Define function "findMaxY"
  //   var maxYValues = data.map(function(d) { 
  //     if (d.visible){
  //       return d3.max(d.values, function(value) { // Return max rating value
  //         return value.rating; });
  //     }
  //   });
  //   return d3.max(maxYValues);
  // }
  
  // function scaleY(){
  //   yScale.domain([d3.min(categories.filter( function(c) { return c.visible }), function(c) { return d3.min(c.values, function(v) { return v.rating; }); }), d3.max(categories.filter( function(c) { return c.visible }), function(c) { return d3.max(c.values, function(v) { return v.rating; }); })]);
  // }

function abbrNum(number, decPlaces) {
    // 2 decimal places => 100, 3 => 1000, etc
    decPlaces = Math.pow(10,decPlaces);

    // Enumerate number abbreviations
    var abbrev = [ "k", "m", "b", "t" ];

    // Go through the array backwards, so we do the largest first
    for (var i=abbrev.length-1; i>=0; i--) {

        // Convert array index to "1000", "1000000", etc
        var size = Math.pow(10,(i+1)*3);

        // If the number is bigger or equal do the abbreviation
        if(size <= number) {
             // Here, we multiply by decPlaces, round, and then divide by decPlaces.
             // This gives us nice rounding to a particular decimal place.
             number = Math.round(number*decPlaces/size)/decPlaces;

             // Handle special case where we round up to the next abbreviation
             if((number == 1000) && (i < abbrev.length - 1)) {
                 number = 1;
                 i++;
             }

             // Add the letter for the abbreviation
             number += abbrev[i];

             // We are done... stop
             break;
        }
    }

    return number;
}