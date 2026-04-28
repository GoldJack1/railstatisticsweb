A new dawn in UK rail analysis - Connecting to the Darwin Push Port
15/11/2024  24/11/2024
Robbie A
2
Welcome
Hello! Over the last few months I have been designing a system to ingest data from National Rail’s Push Port feeds. These feeds contain data relating to all trains running across Network Rail track in the UK. I hope this dataset will allow fellow train and data enthusiasts to explore the weird and wonderful world of rail in the UK - along with holding higher powers accountable for how they run the railway.

In this first post, I wanted to cover the initial stages of development against the National Rail push port feeds.

This is a programmatic feed, so if you want to follow along you will need some software knowledge.

Connecting to the feed
First visit https://opendata.nationalrail.co.uk/ and sign up for an account. Once approved, you will be provided a username and password to connect with. There are several ways you can access train movements data - either through a daily FTP download or via Push Port (which is essentially a live feed). In this blog we’re going to be using the latter - although it does drastically increase application complexity - you’ve been warned!

Installing poetry
I use poetry for python environment management. Make sure you’ve installed poetry on your system before proceeding. Installation instructions can be found here: https://python-poetry.org/docs/.

OS
I use macOS in this tutorial, but all commands should be portable to other unix-like systems. For Windows users, you will need to find the analogous commands yourself!

Setup
Over the last few months I have been building up a repository of code which I have found useful when running analysis across the datasets. This repository is organised into a set of python modules each of which can be independently installed via poetry. In this first example, we will use the clients module which implements a method to connect to the Darwin Push Port feeds.

First you need to clone this (https://github.com/iiAnderson/darwin-connect) repository and run install the poetry environment within the example folder.

git clone https://github.com/iiAnderson/darwin-connect

cd darwin-connect/example

poetry install
This should setup your poetry environment. Once this is done set your national rail username and password as environment variables

export DARWIN_USERNAME=XXX
export DARWIN_PASSWORD=YYY
You should now be able to run the below command and connect directly to the feed.

poetry run python3 cli.py
If you connect succesfully, then you should see lots of JSON being printed in your command line. These are the raw data packets (well.. nearly, they actually arrive in XML format) from the Darwin rail system - and allow you to see live movement of trains across the network.