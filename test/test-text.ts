import {Text} from "@codemirror/text"
import ist from "ist"

function depth(node: Text): number {
  return !node.children ? 1 : 1 + Math.max(...node.children.map(depth))
}

const line = "1234567890".repeat(10)
const lines = new Array(200).fill(line), text0 = lines.join("\n")
const doc0 = Text.of(lines)

describe("Text", () => {
  it("handles basic replacement", () => {
    let doc = Text.of(["one", "two", "three"])
    ist(doc.replace(2, 5, Text.of(["foo", "bar"])).toString(), "onfoo\nbarwo\nthree")
  })

  it("can append documents", () => {
    ist(Text.of(["one", "two", "three"]).append(Text.of(["!", "ok"])).toString(), "one\ntwo\nthree!\nok")
  })

  it("preserves length", () => {
    ist(doc0.length, text0.length)
  })

  it("creates a balanced tree when loading a document", () => {
    let doc = Text.of(new Array(2000).fill(line)), d = depth(doc)
    ist(d, 2, "<=")
  })

  it("rebalances on insert", () => {
    let doc = doc0
    let insert = "abc".repeat(200), at = Math.floor(doc.length / 2)
    for (let i = 0; i < 10; i++) doc = doc.replace(at, at, Text.of([insert]))
    ist(depth(doc), 2, "<=")
    ist(doc.toString(), text0.slice(0, at) + "abc".repeat(2000) + text0.slice(at))
  })

  it("collapses on delete", () => {
    let doc = doc0.replace(10, text0.length - 10, Text.empty)
    ist(depth(doc), 1)
    ist(doc.length, 20)
    ist(doc.toString(), line.slice(0, 20))
  })

  it("handles deleting at start", () => {
    ist(Text.of(lines.slice(0, -1).concat([line + "!"])).replace(0, 9500, Text.empty).toString(), text0.slice(9500) + "!")
  })

  it("handles deleting at end", () => {
    ist(Text.of(["?" + line].concat(lines.slice(1))).replace(9500, text0.length + 1, Text.empty).toString(), "?" + text0.slice(0, 9499))
  })

  it("can handle deleting the entire document", () => {
    ist(doc0.replace(0, doc0.length, Text.empty).toString(), "")
  })

  it("can insert on node boundaries", () => {
    let doc = doc0, pos = doc.children![0].length
    ist(doc.replace(pos, pos, Text.of(["abc"])).slice(pos, pos + 3).toString(), "abc")
  })

  it("can build up a doc by repeated appending", () => {
    let doc = Text.of([""]), text = ""
    for (let i = 1; i < 1000; ++i) {
      let add = "newtext" + i + " "
      doc = doc.replace(doc.length, doc.length, Text.of([add]))
      text += add
    }
    ist(doc.toString(), text)
  })

  it("properly maintains content during editing", () => {
    let str = text0, doc = doc0
    for (let i = 0; i < 200; i++) {
      let insPos = Math.floor(Math.random() * doc.length)
      let insChar = String.fromCharCode("A".charCodeAt(0) + Math.floor(Math.random() * 26))
      str = str.slice(0, insPos) + insChar + str.slice(insPos)
      doc = doc.replace(insPos, insPos, Text.of([insChar]))
      let delFrom = Math.floor(Math.random() * doc.length)
      let delTo = Math.min(doc.length, delFrom + Math.floor(Math.random() * 20))
      str = str.slice(0, delFrom) + str.slice(delTo)
      doc = doc.replace(delFrom, delTo, Text.empty)
    }
    ist(doc.toString(), str)
  })

  it("returns the correct strings for slice", () => {
    let text = []
    for (let i = 0; i < 1000; i++) text.push("0".repeat(4 - String(i).length) + i)
    let doc = Text.of(text)
    let str = text.join("\n")
    for (let i = 0; i < 400; i++) {
      let start = i == 0 ? 0 : Math.floor(Math.random() * doc.length)
      let end = i == 399 ? doc.length : start + Math.floor(Math.random() * (doc.length - start))
      start = 4150; end = 4160
      ist(doc.slice(start, end).toString(), str.slice(start, end))
    }
  })

  it("can be compared", () => {
    let doc = doc0, doc2 = Text.of(lines)
    ist(doc.eq(doc))
    ist(doc.eq(doc2))
    ist(doc2.eq(doc))
    ist(!doc.eq(doc2.replace(5000, 5000, Text.of(["y"]))))
    ist(!doc.eq(doc2.replace(5000, 5001, Text.of(["y"]))))
    ist(doc.eq(doc.replace(5000, 5001, doc.slice(5000, 5001))))
    ist(!doc.eq(doc.replace(5000, 5001, Text.of(["y"]))))
  })

  it("can be compared despite different tree shape", () => {
    ist(doc0.replace(100, 201, Text.of(["abc"])).eq(Text.of([line + "abc"].concat(lines.slice(2)))))
  })

  it("can compare small documents", () => {
    ist(Text.of(["foo", "bar"]).eq(Text.of(["foo", "bar"])))
    ist(!Text.of(["foo", "bar"]).eq(Text.of(["foo", "baz"])))
  })

  it("is iterable", () => {
    for (let iter = doc0.iter(), build = "";;) {
      let {value, lineBreak, done} = iter.next()
      if (done) {
        ist(build, text0)
        break
      }
      if (lineBreak) {
        build += "\n"
      } else {
        ist(value.indexOf("\n"), -1)
        build += value
      }
    }
  })

  it("is iterable in reverse", () => {
    let found = ""
    for (let iter = doc0.iter(-1); !iter.next().done;) found = iter.value + found
    ist(found, text0)
  })

  it("allows negative skip values in iteration", () => {
    let iter = Text.of(["one", "two", "three", "four"]).iter()
    ist(iter.next(12).value, "e")
    ist(iter.next(-12).value, "ne")
    ist(iter.next(12).value, "our")
    ist(iter.next(-1000).value, "one")
  })

  it("is partially iterable", () => {
    let found = ""
    for (let iter = doc0.iterRange(500, doc0.length - 500); !iter.next().done;) found += iter.value
    ist(JSON.stringify(found), JSON.stringify(text0.slice(500, text0.length - 500).toString()))
  })

  it("is partially iterable in reverse", () => {
    let found = ""
    for (let iter = doc0.iterRange(doc0.length - 500, 500); !iter.next().done;) found = iter.value + found
    ist(found, text0.slice(500, text0.length - 500).toString())
  })

  it("can partially iter over subsections at the start and end", () => {
    ist(doc0.iterRange(0, 1).next().value, "1")
    ist(doc0.iterRange(1, 2).next().value, "2")
    ist(doc0.iterRange(doc0.length - 1, doc0.length).next().value, "0")
    ist(doc0.iterRange(doc0.length - 2, doc0.length - 1).next().value, "9")
  })

  it("can iterate over lines", () => {
    let doc = Text.of(["ab", "cde", "", "", "f", "", "g"])
    function get(from?: number, to?: number) {
      let result = []
      for (let i = doc.iterLines(from, to); !i.next().done;) result.push(i.value)
      return result.join("\n")
    }
    ist(get(), "ab\ncde\n\n\nf\n\ng")
    ist(get(1, doc.lines + 1), "ab\ncde\n\n\nf\n\ng")
    ist(get(2, 3), "cde")
    ist(get(1, 1), "")
    ist(get(2, 1), "")
    ist(get(3), "\n\nf\n\ng")
  })

  it("can convert to JSON", () => {
    for (let i = 0; i < 200; i++) lines.push("line " + i)
    let text = Text.of(lines)
    ist(Text.of(text.toJSON()).eq(text))
  })

  it("can get line info by line number", () => {
    ist.throws(() => doc0.line(0), /Invalid line/)
    ist.throws(() => doc0.line(doc0.lines + 1), /Invalid line/)
    for (let i = 1; i < doc0.lines; i += 5) {
      let l = doc0.line(i)
      ist(l.from, (i - 1) * 101)
      ist(l.to, i * 101 - 1)
      ist(l.number, i)
      ist(l.text, line)
    }
  })

  it("can get line info by position", () => {
    ist.throws(() => doc0.lineAt(-10), /Invalid position/)
    ist.throws(() => doc0.lineAt(doc0.length + 1), /Invalid position/)
    for (let i = 0; i < doc0.length; i += 5) {
      let l = doc0.lineAt(i)
      ist(l.from, i - (i % 101))
      ist(l.to, i - (i % 101) + 100)
      ist(l.number, Math.floor(i / 101) + 1)
      ist(l.text, line)
    }
  })

  it("can delete a range at the start of a child node", () => {
    ist(doc0.replace(0, 100, Text.of(["x"])).toString(), "x" + text0.slice(100))
  })

  it("can retrieve pieces of text", () => {
    for (let i = 0; i < 500; i++) {
      let from = Math.floor(Math.random() * (doc0.length - 1))
      let to = Math.random() < .5 ? from + 2 : from + Math.floor(Math.random() * (doc0.length - 1 - from)) + 1
      ist(doc0.sliceString(from, to), text0.slice(from, to))
      ist(doc0.slice(from, to).toString(), text0.slice(from, to))
    }
  })
})
