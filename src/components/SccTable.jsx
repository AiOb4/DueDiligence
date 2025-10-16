import './tableStyles.css';

export default function SccTable({ data }) {
  if (!data || data.length === 0) return <p>No data to display.</p>;

  return (
    <div className="scc-table-container">
      <table className="scc-table">
        <thead>
          <tr>
            <th>Language</th>
            <th>Files</th>
            <th>Lines</th>
            <th>Code</th>
            <th>Comments</th>
            <th>Blank</th>
          </tr>
        </thead>
        <tbody>
          {data.map((lang) => (
            <tr key={lang.Name}>
              <td>{lang.Name}</td>
              <td>{lang.Count}</td>
              <td>{lang.Lines}</td>
              <td>{lang.Code}</td>
              <td>{lang.Comment}</td>
              <td>{lang.Blank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
