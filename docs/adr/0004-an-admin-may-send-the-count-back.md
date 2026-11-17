# An Admin may send the count back

The count of Registration numbers only goes up, so once a series (singles or Pairs) has handed out the top of its range, every later Registration of that series is refused for the rest of the Race, at the Race desk too. It happens after a typo in a First number (995 instead of 181) or when the other registration platform used most of the range. The way out is the Next number: an Admin sets where a series continues, ahead or back, on the Race settings page. Going back means numbers the count has passed can be handed out again, and most of those belonged to a Registration that was deleted, whose bib may already be out. The app does not remember deleted Registrations' numbers. Instead, before going back, it lists the free numbers it would hand out again („23, 57, 181–994“), so the desk can collect those bibs or reserve the numbers, and asks again if the list changed meanwhile.

## Considered options

- **Lowering the First number restarts the count.** Same risk, hidden inside an existing field, and the same change would do nothing until the series is full.
- **The count wraps on its own** at the top of the range, to the lowest number never handed out. Needs a record of every number ever handed out (a migration), and no Admin is in the loop.
- **No way out in the app:** paper at the desk and SQL on the database. The desk is stuck until someone runs it.
