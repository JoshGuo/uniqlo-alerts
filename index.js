const fetch = require('cross-fetch')
const jsdom = require('jsdom')
const fs = require('fs')
const mongodb = require('mongodb').MongoClient;

require('dotenv').config();

const sendMessage = false;
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const url = 'https://www.uniqlo.com/us/en/men-supima%C2%A9-cotton-crew-neck-short-sleeve-t-shirt-422990.html'

class Item {
    constructor(name, price, link) {
        this.name = name;
        this.price = price;
        this.link = link;
    }

    toString() {
        return this.name + ' | ' + this.price + '\n--------\n' + this.link;
    }
}

var string = 'UNIQLO PRICE UPDATE:\n';
var newSales = 0;

(async () => {
    var prevRecord;

    //Collect the previous days prices
    const client = await mongodb.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    prevRecord = await client.db('uniqlo-alerts').collection('data').findOne();

    console.log(prevRecord);

    var html = await fetch(url, {headers: {'user-agent': 'Mozilla/5.0'}, credentials: 'inlude'})
    var htmlText = await html.text();
    var dom = new jsdom.JSDOM(htmlText);
    var document = dom.window.document;

    //Iterate through all colors and keep track of the ones with newly reduced prices
    document.querySelectorAll('.swatchanchor').forEach((element) => {
        var name = element.attributes.getNamedItem('title').textContent;
        var link = element.href;

        var priceMapElement = element.attributes.getNamedItem('data-price');
        var priceMap = JSON.parse(priceMapElement.textContent);

        var salepriceStr = '$' + priceMap.saleprice; //This is a string formatted as XXXX____X.XX
        var saleprice = parseFloat(priceMap.saleprice)

        var shirt = new Item(name, salepriceStr, link);

        var prevPrice = prevRecord[name] ? prevRecord[name] : 100

        if(saleprice < prevPrice && saleprice < 6) {
            newSales++;
            string += shirt.toString() + '\n\n';
        }

        prevRecord[name] = saleprice;
    });

    console.log(prevRecord);

    // fs.writeFileSync('data.json', JSON.stringify(prevRecord), (err) => {
    //     if(err) console.log(err)
    // })

    const query = {_id: prevRecord._id}

    let i = await client.db('uniqlo-alerts').collection('data').replaceOne(query, prevRecord);

    //Send notification text if there are new sales available. Otherwise, quit
    if(newSales > 0) {
        console.log('NEW SALES FOUND');
        console.log(string)

        if(sendMessage) {
            console.log('SENDING MESSAGE');
            let msg = await twilio.messages.create({
                body: string,
                from: process.env.TWILIO_FROM_NUMBER,
                to: process.env.TWILIO_TO_NUMBER
            });
            console.log('MESSAGE SENT: ' + msg.sid);
        }
        
        
    }else {
        console.log('NO SALES FOUND');
    }

    process.exit();
})()
.catch(ex => {
    console.log(ex)
    process.exit();
});