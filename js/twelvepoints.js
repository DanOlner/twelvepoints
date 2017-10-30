//Short month names from date
//https://stackoverflow.com/a/33716710
var monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

function getShortMonth(d) {
    var t = new Date(d);
    return monthShortNames[t.getMonth()]
}

//circlexy makes a circle in a -1/1 range (just straight cos/sin)
//So scale correctly
//And scale neg to neg / pos to pos so zero stays at centre
//n can be scaled for text by multiplying
var xScale = d3.scaleLinear().domain([-1, 1]).range([-220, 220])
var yScale = d3.scaleLinear().domain([-1, 1]).range([220, -220])

function circlexy(i) {

    //First month at top, advances clockwise
    var angle = ((3 - i) / 6) * Math.PI
    return([xScale(Math.cos(angle)), yScale(Math.sin(angle))])

}

d3.csv('twelvepoints.csv', function (err, csv) {

    d3.select("g.circle")
            .selectAll("line")
            .data(csv)
            .enter()
            .append("line")
            .attrs(
                    {
                        x1: function (d, i) {
                            return circlexy(i)[0]
                        },
                        y1: function (d, i) {
                            return circlexy(i)[1]
                        },
                        x2: function (d, i) {
                            return circlexy(i + 1)[0]
                        },
                        y2: function (d, i) {
                            return circlexy(i + 1)[1]
                        },
                        class: function (d) {

                            //Adjust to one month ahead
                            //So it's marked when the whole month has passed
                            adjustDate = new Date(d.month)
                            adjustDate.setMonth(adjustDate.getMonth() + 1)

                            //if it's the current month
                            if (new Date(d.month).getMonth() == new Date().getMonth()) {
                                return("now")
                                //If date hasn't passed...
                            } else if (adjustDate > new Date()) {
                                return("future")
                                //otherwise use status as class name
                            } else
                                return d.status
                        }
                    }
            )

    //Points
    d3.select("g.circle")
            .selectAll("circle")
            .data(csv)
            .enter()
            .append("circle")
            .attrs({
                cx: function (d, i) {
                    return circlexy(i)[0]
                },
                cy: function (d, i) {
                    return circlexy(i)[1]
                },
                r: 8
            })


    //Month labels
    d3.select("g.circle")
            .selectAll("text")
            .data(csv)
            .enter()
            .append("text")
            .attrs({
                x: function (d, i) {
                    return circlexy(i)[0] * 1.15
                },
                y: function (d, i) {
                    return circlexy(i)[1] * 1.15
                },
                dy: 5,
                "text-anchor": "middle"
            })
            .text(function (d) {
                return getShortMonth(d.month)
            })

})