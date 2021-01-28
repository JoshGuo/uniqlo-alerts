const fetch = require('cross-fetch')
const jsdom = require('jsdom')
const fs = require('fs')
const prevRecord = require('./data.json')
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
    var html = await fetch(url, {headers: {'user-agent': 'Mozilla/5.0'}, credentials: 'inlude'})
    var htmlText = await html.text();
    var dom = new jsdom.JSDOM(htmlText);
    var document = dom.window.document;
    

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
    
    console.log(string);

    fs.writeFileSync('data.json', JSON.stringify(prevRecord), (err) => {
        if(err) console.log(err)
    })


    if(sendMessage && newSales > 0) {
        let msg = await twilio.messages.create({
            body: string,
            from: process.env.TWILIO_FROM_NUMBER,
            to: process.env.TWILIO_TO_NUMBER
        })
        
        console.log(msg.sid);
    }

    process.exit();
})()

