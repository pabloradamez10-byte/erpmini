import { fmtCur, fmtPercent, parseMoney } from "../utils/format.js";
import { BarcodeImage, generateBarcode } from "./barcode.jsx";

const inputStyle = { width:"100%", padding:"10px 12px", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"15px", boxSizing:"border-box", outline:"none" };
const button = (color) => ({ background:color||"#e94560", color:"#fff", border:"none", borderRadius:"10px", padding:"12px 18px", cursor:"pointer", fontWeight:"700", fontSize:"15px" });
const smallButton = (color) => ({ background:color||"#64748b", color:"#fff", border:"none", borderRadius:"8px", padding:"7px 10px", cursor:"pointer", fontSize:"12px", fontWeight:"700", minWidth:"64px" });
const tag = (color) => ({ background:color, color:"#fff", borderRadius:"20px", padding:"3px 10px", fontSize:"11px", display:"inline-block" });
const card = { background:"#fff", borderRadius:"14px", padding:"16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", marginBottom:"14px" };

export default function InventoryTab({
  isMobile,
  editingId,
  setEditingId,
  newProduct,
  setNewProduct,
  products,
  searchProduct,
  setSearchProduct,
  onSave,
  onEdit,
  onDelete,
  onPrintLabels,
  onShowBarcode
}) {
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchProduct))
  );

  const cancelEditing = () => {
    setEditingId(null);
    setNewProduct({ name:"", cost:"", price:"", stock:"", category:"Geral", barcode:"" });
  };

  return (
    <div>
      <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
          <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:"#ffe4e6", color:"#e94560", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", fontWeight:"900" }}>EST</div>
          <div>
            <div style={{ fontWeight:"900", fontSize:"21px", color:"#0f172a" }}>{editingId ? "Editar Produto" : "Novo Produto"}</div>
            <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>Preencha os dados para cadastrar ou atualizar o produto.</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"12px" }}>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Nome do Produto</label>
            <input style={inputStyle} type="text" value={newProduct.name} placeholder="Ex: Rosa vermelha" onChange={event=>setNewProduct({...newProduct,name:event.target.value})} />
          </div>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Categoria</label>
            <input style={inputStyle} type="text" value={newProduct.category} placeholder="Geral" onChange={event=>setNewProduct({...newProduct,category:event.target.value})} />
          </div>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Custo (R$)</label>
            <input style={inputStyle} inputMode="decimal" value={newProduct.cost} placeholder="0,00" onChange={event=>setNewProduct({...newProduct,cost:event.target.value})} />
          </div>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Venda (R$)</label>
            <input style={inputStyle} inputMode="decimal" value={newProduct.price} placeholder="0,00" onChange={event=>setNewProduct({...newProduct,price:event.target.value})} />
          </div>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Estoque</label>
            <input style={inputStyle} inputMode="numeric" value={newProduct.stock} placeholder="0" onChange={event=>setNewProduct({...newProduct,stock:event.target.value.replace(/[^0-9]/g,"")})} />
          </div>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Código de Barras</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px" }}>
              <input style={{ ...inputStyle, fontFamily:"monospace" }} value={newProduct.barcode} placeholder="Automático se vazio" onChange={event=>setNewProduct({...newProduct,barcode:event.target.value})} />
              <button style={{ ...smallButton("#6366f1"), minWidth:"82px", fontSize:"13px" }} onClick={()=>setNewProduct({...newProduct,barcode:generateBarcode()})}>Gerar</button>
            </div>
          </div>
        </div>

        {newProduct.barcode && (
          <div style={{ marginTop:"12px", background:"#f8fafc", borderRadius:"14px", padding:"12px", textAlign:"center", overflowX:"auto" }}>
            <BarcodeImage value={newProduct.barcode} />
          </div>
        )}

        <div style={{ display:"flex", gap:"8px", marginTop:"14px" }}>
          <button style={{ ...button("#e94560"), flex:1, borderRadius:"14px", padding:"14px", fontSize:"16px" }} onClick={onSave}>
            {editingId ? " Salvar Alterações" : " Cadastrar Produto"}
          </button>
          {editingId && <button style={{ ...button("#64748b"), borderRadius:"14px" }} onClick={cancelEditing}>Cancelar</button>}
        </div>
      </div>

      <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", marginBottom:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#ffe4e6", color:"#e94560", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px" }}>EST</div>
            <div style={{ fontWeight:"900", fontSize:"20px", color:"#0f172a" }}>Estoque de Produtos ({products.length})</div>
          </div>
          <input style={{ ...inputStyle, maxWidth:isMobile?"170px":"260px", padding:"9px 11px" }} placeholder="Pesquisar..." value={searchProduct} onChange={event=>setSearchProduct(event.target.value)} />
        </div>

        {filteredProducts.length === 0 ? (
          <div style={{ color:"#94a3b8", fontWeight:"800", padding:"12px" }}>Nenhum produto encontrado.</div>
        ) : filteredProducts.map((product) => {
          const cost = parseMoney(product.cost || product.lastCost || 0);
          const price = parseMoney(product.price || 0);
          const profit = price - cost;
          const margin = price > 0 ? (profit / price) * 100 : 0;
          return (
            <div key={product.id} style={{ padding:"14px", border:"1px solid #e2e8f0", borderRadius:"18px", marginBottom:"12px", background:"#fff" }}>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr", gap:"12px", alignItems:"center" }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:"#ffe4e6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px" }}>EST</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{product.name}</div>
                      {product.barcode && <div style={{ fontSize:"12px", color:"#64748b", fontFamily:"monospace", marginTop:"2px" }}>Código: {product.barcode}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", marginTop:"10px" }}>
                    <span style={tag("#6366f1")}>{product.category || "Geral"}</span>
                    <span style={tag(product.stock>5?"#22c55e":product.stock>0?"#f59e0b":"#ef4444")}>{product.stock} un. em estoque</span>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", borderLeft:isMobile?"none":"1px solid #e2e8f0", paddingLeft:isMobile?"0":"14px" }}>
                  <div><div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Custo</div><div style={{ fontWeight:"900", color:"#0f172a" }}>{fmtCur(cost)}</div></div>
                  <div><div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Margem</div><div style={{ fontWeight:"900", color:margin>=0?"#16a34a":"#dc2626" }}>{fmtPercent(margin)}</div></div>
                  <div><div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Venda</div><div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(price)}</div></div>
                  <div><div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Lucro</div><div style={{ fontWeight:"900", color:profit>=0?"#16a34a":"#dc2626" }}>{fmtCur(profit)}</div></div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px", marginTop:"14px" }}>
                <button title="Ver código" style={{ ...smallButton("#eff6ff"), color:"#2563eb", border:"1px solid #bfdbfe", padding:"10px", fontSize:"13px" }} onClick={()=>onShowBarcode(product)}>Código  Código</button>
                <button title="Imprimir etiqueta" style={{ ...smallButton("#f0fdf4"), color:"#16a34a", border:"1px solid #bbf7d0", padding:"10px", fontSize:"13px" }} onClick={()=>onPrintLabels(product)}>Etiqueta  Etiqueta</button>
                <button title="Editar" style={{ ...smallButton("#eff6ff"), color:"#2563eb", border:"1px solid #bfdbfe", padding:"10px", fontSize:"13px" }} onClick={()=>onEdit(product)}>Editar  Editar</button>
                <button title="Excluir" style={{ ...smallButton("#fff1f2"), color:"#e11d48", border:"1px solid #fecdd3", padding:"10px", fontSize:"13px" }} onClick={()=>onDelete(product.id)}>Excluir  Excluir</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
