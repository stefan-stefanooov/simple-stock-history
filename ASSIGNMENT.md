# Technical Home Assignment - SE, Webservice SRE

Create a simple session-less Web Application (Web Service + Frontend) with the following
requirements:

## Non-functional requirements

The presented solution must be production-ready.

## Functional requirements

1. **Data** - the server stores the price history of a share sold on the stock market during
   some time period.
   - The data is static.
   - The history is without interruption with a discretion interval of one second (a price
     value for each second).
   - The stored data is in some period explicitly known in advance (from - to).
   - Usage of a database engine is not a must. Please represent the static data as you see fit.

2. **Functional spec**
   - The main purpose of the implemented Web Service is: given a query that consists of a time
     slice (within the whole data period) a client will receive two points in time - "buy time"
     and "sell time", which represent the most profitable choice for buying and selling stocks
     during the given time slice (i.e. when to buy and when to sell in order to make the most
     profit).
   - Both time points should be within the query time slice.
   - The "buy time" point should be before the "sell time" point, naturally :)
   - If there is more than one best solution with equal profit, the service should return the
     one that is earliest and shortest.

3. **API**
   - The Web Service accepts two time points as parameters - the start and end points of the
     time slice within which a solution is searched for.
   - The returned result contains the "buy point", "sell point" and the stock prices at the two
     time points.
   - The API should offer adequate response in case of erroneous data.

4. **Deployment and monitoring**
   - The application should be deployed/deployable on a platform of your choice.
   - The application should be observable on an observability platform of your choice.

5. **UI (UX)**
   - The user interface should be minimalistic.
   - It should offer a choice of query time period.
   - The query should be invoked via a button.
   - Additionally, the interface should contain a field, which the user will fill with available
     funds - the maximum sum that the user can spend to buy stock.
   - The result should be printed in a human readable way - stating the buy date, sell date, how
     many stocks could have been bought and sold and what would have been the profit.
